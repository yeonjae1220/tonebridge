/** Shared facts for the public privacy policy and terms pages. */

export const LEGAL_CONTACT_EMAIL = 'support@mungji.com'
export const LEGAL_OPERATOR = { ko: 'ToneBridge 운영자', en: 'The ToneBridge operator' } as const
export const LEGAL_EFFECTIVE_DATE = '2026-11-26'
export const LEGAL_MINIMUM_AGE = 14

export type LegalLanguage = 'ko' | 'en'

/**
 * The page is opened from the app's in-app browser without the web's language cookie,
 * so an explicit ?lang= wins, then the web cookie, then the browser's languages.
 */
export function pickLegalLanguage(
  requested: string | undefined,
  cookieLanguage: string | undefined,
  acceptLanguage: string | null,
): LegalLanguage {
  for (const candidate of [requested, cookieLanguage]) {
    if (candidate === 'ko' || candidate === 'en') return candidate
  }
  if (cookieLanguage) return 'en'
  return acceptLanguage?.trim().toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

export interface LegalSection {
  heading: string
  paragraphs?: string[]
  items?: string[]
}

export interface LegalDocumentContent {
  title: string
  intro: string
  sections: LegalSection[]
}
