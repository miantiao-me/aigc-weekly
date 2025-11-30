import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/config'
import { getWeeklyList } from '@/lib/weekly/data'

export const revalidate = 604800 // 1 week

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const weeklyResult = await getWeeklyList({ pageSize: 9999 })
  const weeks = weeklyResult.items

  const baseUrl = siteConfig.metadataBase && siteConfig.metadataBase.toString().replace(/\/$/, '')

  const weeklyUrls = weeks.map(week => ({
    url: `${baseUrl}/weekly/${week.slug}`,
    lastModified: new Date(week.publishDate),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...weeklyUrls,
  ]
}
