import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { Providers } from './providers'
import { AppShell } from '@/components/AppShell'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const BASE_URL = 'https://tonebridge.mungji.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'ToneBridge',
    template: '%s | ToneBridge',
  },
  description: '원어민과 함께하는 언어 교정 교환 커뮤니티. 내 글을 교정받고, 상대방의 글을 교정해주세요.',
  keywords: ['언어 교정', '외국어 교환', '원어민', 'language correction', 'language exchange'],
  authors: [{ name: 'ToneBridge' }],
  creator: 'ToneBridge',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: BASE_URL,
    siteName: 'ToneBridge',
    title: 'ToneBridge — 언어 교정 교환 커뮤니티',
    description: '원어민과 함께하는 언어 교정 교환 커뮤니티. 내 글을 교정받고, 상대방의 글을 교정해주세요.',
    images: [
      {
        url: '/icons/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ToneBridge',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ToneBridge — 언어 교정 교환 커뮤니티',
    description: '원어민과 함께하는 언어 교정 교환 커뮤니티.',
    images: ['/icons/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ToneBridge',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3B82F6' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
}

const themeInitScript = `
(() => {
  try {
    const preference = localStorage.getItem('tonebridge_theme') || 'system';
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolvedTheme = preference === 'dark' || (preference === 'system' && systemDark) ? 'dark' : 'light';
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  } catch (_) {}
})();
`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? ''
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className={inter.variable} data-nonce={nonce}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
