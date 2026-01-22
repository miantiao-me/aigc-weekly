import { Container, getContainer } from '@cloudflare/containers'
import { env } from 'cloudflare:workers'
import { processSSEStream } from './sse'

const PORT = 2442

const containerEnv = Object.fromEntries(
  Object.entries(env).filter(([, value]) => typeof value === 'string'),
)

export class AgentContainer extends Container {
  sleepAfter = '10m'
  defaultPort = PORT

  private _watchPromise?: Promise<void>

  envVars = {
    ...containerEnv,
    PORT: PORT.toString(),
  }

  async watchContainer() {
    try {
      const res = await this.containerFetch('http://container/global/event')
      const reader = res.body?.getReader()
      if (reader) {
        await processSSEStream(reader, (event) => {
          const eventType = event.payload?.type

          if (eventType === 'session.updated') {
            this.renewActivityTimeout()
            console.info('Renewed container activity timeout')
          }

          if (eventType !== 'message.part.updated') {
            console.info('SSE event:', JSON.stringify(event.payload))
          }
        })
      }
    }
    catch (error) {
      console.error('SSE connection error:', error)
    }
  }

  override async onStart(): Promise<void> {
    // 不 await，让 SSE 监听在后台运行，避免阻塞 blockConcurrencyWhile
    this._watchPromise = this.watchContainer()
  }
}

export async function forwardRequestToContainer(request: Request) {
  const container = getContainer(env.AGENT_CONTAINER)

  return container.fetch(request)
}

export async function triggerWeeklyTask() {
  const container = getContainer(env.AGENT_CONTAINER)
  const headers = { 'Content-Type': 'application/json' }

  const createRes = await container.fetch(
    'http://container/session',
    { method: 'POST', headers, body: JSON.stringify({}) },
  )
  if (!createRes.ok)
    throw new Error(`Failed to create session: ${createRes.status}`)

  const session = await createRes.json() as { id: string }
  console.info(`Created session: ${session.id}`)

  container.fetch(
    `http://container/session/${session.id}/command`,
    { method: 'POST', headers, body: JSON.stringify({ command: 'weekly', arguments: '' }) },
  )

  console.info(`Weekly task triggered: ${session.id}`)
}
