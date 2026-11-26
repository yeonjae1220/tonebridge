import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { LegalDocument } from '@/components/legal/LegalDocument'
import { pickLegalLanguage } from '@/lib/legal'
import { UI_LANGUAGE_KEY } from '@/i18n/messages'
import { PRIVACY_CONTENT } from './content'

export const metadata: Metadata = {
  title: '개인정보 처리방침 · Privacy Policy',
  alternates: { canonical: '/privacy' },
}

interface Props {
  searchParams: Promise<{ lang?: string }>
}

export default async function PrivacyPage({ searchParams }: Props) {
  const [{ lang }, cookieStore, headerList] = await Promise.all([searchParams, cookies(), headers()])
  const language = pickLegalLanguage(lang, cookieStore.get(UI_LANGUAGE_KEY)?.value, headerList.get('accept-language'))
  return <LegalDocument path="/privacy" language={language} content={PRIVACY_CONTENT[language]} />
}
