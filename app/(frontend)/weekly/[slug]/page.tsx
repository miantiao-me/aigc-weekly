import type { Metadata } from 'next'
import markdownIt from 'markdown-it-ts'
import Link from 'next/link'

import { Pagination } from '@/components/theme/Pagination'

import { PostMeta } from '@/components/theme/PostMeta'
import { TagList } from '@/components/theme/TagList'
import { TerminalLayout } from '@/components/theme/TerminalLayout'
import { getWeeklyBySlug } from '@/lib/weekly/data'

interface WeeklyDetailPageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: WeeklyDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const weekly = await getWeeklyBySlug(slug)

  if (!weekly) {
    return {
      title: `周刊未找到`,
    }
  }

  return {
    title: `${weekly.title}`,
    description: weekly.summary,
  }
}

export default async function WeeklyDetailPage({ params }: WeeklyDetailPageProps) {
  const { slug } = await params
  const weekly = await getWeeklyBySlug(slug)

  if (!weekly) {
    return (
      <TerminalLayout>
        <div className="post">
          <div className="post-content">
            <p>未找到对应的周刊，请返回列表查看其它期刊。</p>
            <Link href="/weekly">返回列表</Link>
          </div>
        </div>
      </TerminalLayout>
    )
  }

  const markdownRenderer = markdownIt({
    html: false,
    linkify: true,
    typographer: true,
  })
  const html = markdownRenderer.render(weekly.content)

  const prevLink = weekly.prev
    ? { href: `/weekly/${weekly.prev.slug}`, text: weekly.prev.title }
    : undefined
  const nextLink = weekly.next
    ? { href: `/weekly/${weekly.next.slug}`, text: weekly.next.title }
    : undefined

  return (
    <TerminalLayout>
      <article className="post">
        <h1 className="post-title">
          <Link href={`/weekly/${weekly.issueNumber}`}>{weekly.title}</Link>
        </h1>

        <PostMeta date={weekly.publishDate} issueNumber={weekly.issueNumber} />

        <TagList tags={weekly.tags} />

        {/* Markdown 内容经由 markdown-it 渲染，仅展示服务端输出 */}
        {/* eslint-disable-next-line react-dom/no-dangerously-set-innerhtml */}
        <div className="post-content" dangerouslySetInnerHTML={{ __html: html }} />

        <Pagination
          prev={prevLink}
          next={nextLink}
        />
      </article>
    </TerminalLayout>
  )
}
