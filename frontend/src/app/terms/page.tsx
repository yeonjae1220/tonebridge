import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { LegalDocument } from '@/components/legal/LegalDocument'
import { pickLegalLanguage } from '@/lib/legal'
import { UI_LANGUAGE_KEY } from '@/i18n/messages'
import { TERMS_CONTENT } from './content'

export const metadata: Metadata = {
  title: '이용약관 · Terms of Service',
  alternates: { canonical: '/terms' },
}

interface Props {
  searchParams: Promise<{ lang?: string }>
}

export default async function TermsPage({ searchParams }: Props) {
  const [{ lang }, cookieStore, headerList] = await Promise.all([searchParams, cookies(), headers()])
  const language = pickLegalLanguage(lang, cookieStore.get(UI_LANGUAGE_KEY)?.value, headerList.get('accept-language'))
  return <LegalDocument path="/terms" language={language} content={TERMS_CONTENT[language]} />
}
