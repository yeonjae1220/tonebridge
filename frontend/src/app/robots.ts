import type { MetadataRoute } from 'next'

const BASE_URL = 'https://tonebridge.mungji.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/feed', '/study', '/login'],
        disallow: ['/profile/', '/wallet/', '/admin/', '/auth/', '/onboarding', '/request', '/correct/', '/result/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
