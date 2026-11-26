import Link from 'next/link'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  type LegalDocumentContent,
  type LegalLanguage,
} from '@/lib/legal'

interface Props {
  path: '/privacy' | '/terms'
  language: LegalLanguage
  content: LegalDocumentContent
}

const OTHER_PAGE = {
  '/privacy': { href: '/terms', ko: '이용약관', en: 'Terms of Service' },
  '/terms': { href: '/privacy', ko: '개인정보 처리방침', en: 'Privacy Policy' },
} as const

export function LegalDocument({ path, language, content }: Props) {
  const ko = language === 'ko'
  const other = OTHER_PAGE[path]
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24 space-y-6 text-sm leading-relaxed">
      <nav aria-label={ko ? '언어' : 'Language'} className="flex gap-4">
        <Link href={`${path}?lang=ko`} aria-current={ko ? 'page' : undefined} className={ko ? 'font-semibold' : 'text-blue-600 underline'}>한국어</Link>
        <Link href={`${path}?lang=en`} aria-current={ko ? undefined : 'page'} className={ko ? 'text-blue-600 underline' : 'font-semibold'}>English</Link>
      </nav>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{content.title}</h1>
        <p className="text-gray-500">{ko ? `시행일 ${LEGAL_EFFECTIVE_DATE}` : `Effective ${LEGAL_EFFECTIVE_DATE}`}</p>
        <p>{content.intro}</p>
      </header>
      {content.sections.map((section, index) => (
        <section key={section.heading} aria-labelledby={`legal-${index}`} className="space-y-2">
          <h2 id={`legal-${index}`} className="text-base font-semibold">{`${index + 1}. ${section.heading}`}</h2>
          {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.items && (
            <ul className="list-disc space-y-1 pl-5">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </section>
      ))}
      <footer className="space-y-2 border-t border-gray-200 pt-4">
        <p>
          {ko ? '문의: ' : 'Contact: '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-blue-600 underline">{LEGAL_CONTACT_EMAIL}</a>
        </p>
        <Link href={`${other.href}?lang=${language}`} className="inline-flex min-h-11 items-center text-blue-600 underline">
          {ko ? other.ko : other.en}
        </Link>
      </footer>
    </main>
  )
}
