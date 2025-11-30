/* eslint-disable node/prefer-global/process */
const title = 'Agili 的 AIGC 周刊'
const description = `Agili 的 AIGC 周刊 是一份专注于人工智能生成内容（AIGC）领域的精选周刊。

这里汇集了每周最新的 AI 进展、工具发现与深度观点，旨在为你提供高质量的行业洞察。`

const keywords = ['AIGC', 'AI', '人工智能', '周刊', 'Agentic AI', '资讯', '工具', '资源']

export const siteConfig = {
  title,
  description,
  keywords,
  authors: [
    {
      name: 'Agili',
      url: process.env.NEXT_PUBLIC_BASE_URL,
    },
  ],
  creator: 'Agili',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: process.env.NEXT_PUBLIC_BASE_URL,
    title,
    description,
    siteName: title,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  icons: {
    icon: '/favicon.ico',
  },
  alternates: {
    types: {
      'application/rss+xml': `${process.env.NEXT_PUBLIC_BASE_URL}/rss.xml`,
    },
  },
  metadataBase: process.env.NEXT_PUBLIC_BASE_URL ? new URL(process.env.NEXT_PUBLIC_BASE_URL) : undefined,
}

export type SiteConfig = typeof siteConfig
