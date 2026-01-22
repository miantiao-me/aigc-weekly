export function getWeekInfo(targetDate) {
  let date
  if (targetDate === undefined) {
    date = new Date()
  }
  else if (typeof targetDate === 'string') {
    date = new Date(`${targetDate}T00:00:00Z`)
  }
  else {
    date = targetDate
  }

  const utcYear = date.getUTCFullYear()
  const utcMonth = date.getUTCMonth()
  const utcDate = date.getUTCDate()
  const utcDay = date.getUTCDay()

  const sundayDate = new Date(Date.UTC(utcYear, utcMonth, utcDate - utcDay))
  const saturdayDate = new Date(Date.UTC(utcYear, utcMonth, utcDate + (6 - utcDay)))

  const weekNumber = calculateWeekNumber(sundayDate)
  const weekYear = sundayDate.getUTCFullYear()
  const yearShort = String(weekYear).slice(-2)
  const yearFull = String(weekYear)

  const startDate = formatDateUTC(sundayDate)
  const endDate = formatDateUTC(saturdayDate)
  const weekId = `Y${yearShort}W${weekNumber}`

  // 当前真实日期（让下游大模型知道"今天是几号"）
  const today = new Date()
  const currentDate = formatDateUTC(today)

  return {
    weekId,
    weekNumber,
    yearShort,
    yearFull,
    startDate,
    endDate,
    currentDate,
    timezone: 'UTC+0',
  }
}

function calculateWeekNumber(sundayDate) {
  const year = sundayDate.getUTCFullYear()
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const jan1Day = jan1.getUTCDay()
  const firstSunday = jan1Day === 0
    ? jan1
    : new Date(Date.UTC(year, 0, 1 + (7 - jan1Day)))

  if (sundayDate < firstSunday) {
    return '00'
  }

  const diffTime = sundayDate.getTime() - firstSunday.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const weekNum = Math.floor(diffDays / 7) + 1

  return String(weekNum).padStart(2, '0')
}

function formatDateUTC(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function generateHNUrls(startDate, endDate) {
  const urls = []
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)

  const current = new Date(start)
  // eslint-disable-next-line no-unmodified-loop-condition
  while (current <= end) {
    const dateStr = formatDateUTC(current)
    urls.push(`https://news.ycombinator.com/front?day=${dateStr}`)
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return urls
}

export function formatWeekParams(weekInfo) {
  return `\`\`\`yaml
# 周刊参数（请原样传递给下游任务）
week_id: ${weekInfo.weekId}
week_number: ${weekInfo.weekNumber}
year_short: ${weekInfo.yearShort}
year_full: ${weekInfo.yearFull}
start_date: ${weekInfo.startDate}
end_date: ${weekInfo.endDate}
current_date: ${weekInfo.currentDate}
timezone: ${weekInfo.timezone}
\`\`\``
}

export function getWeeklyFilename(weekInfo) {
  return `aigc-weekly-y${weekInfo.yearShort}-w${weekInfo.weekNumber}.md`
}

export function getWeeklyTitle(weekInfo) {
  return `Agili 的 AIGC 周刊（${weekInfo.weekId}）`
}
