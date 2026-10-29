import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { cookies, headers } from 'next/headers'
import './globals.css'
import { Providers } from './providers'
import { AppShell } from '@/components/AppShell'
import { normalizeUiLanguage, UI_LANGUAGE_KEY } from '@/i18n/messages'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const BASE_URL = 'https://tonebridge.mungji.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'ToneBridge',
    template: '%s | ToneBridge',
  },
  description: '친구와 표현과 음성을 나누고 서로의 피드백으로 다시 연습하는 무료 언어 학습 공간.',
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
    description: '친구와 표현과 음성을 나누고 서로의 피드백으로 다시 연습하는 무료 언어 학습 공간.',
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
    description: '친구와 함께하는 무료 상호 언어 학습.',
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
    const preference = localStorage.getItem('tonebridge_theme') || 'dark';
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolvedTheme = preference === 'dark' || (preference === 'system' && systemDark) ? 'dark' : 'light';
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  } catch (_) {
    const root = document.documentElement;
    root.classList.add('dark');
    root.dataset.theme = 'dark';
    root.style.colorScheme = 'dark';
  }
})();
`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()])
  const nonce = headerList.get('x-nonce') ?? ''
  const initialLanguage = normalizeUiLanguage(cookieStore.get(UI_LANGUAGE_KEY)?.value)
  return (
    <html lang={initialLanguage} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className={inter.variable} data-nonce={nonce}>
        <Providers initialLanguage={initialLanguage}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
