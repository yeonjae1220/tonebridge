'use client'

import Link from 'next/link'
import { useI18n } from '@/i18n/I18nProvider'
import { languageDisplayName } from '@/i18n/messages'
import { InstallBanner } from '@/components/ui/InstallBanner'
import { UiLanguageSwitcher } from '@/components/ui/UiLanguageSwitcher'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const STEPS = [
  { num: '01', titleKey: 'landing.step1.title', descKey: 'landing.step1.desc' },
  { num: '02', titleKey: 'landing.step2.title', descKey: 'landing.step2.desc' },
  { num: '03', titleKey: 'landing.step3.title', descKey: 'landing.step3.desc' },
] as const

const EXAMPLES = [
  {
    lang: 'en',
    flag: '🇺🇸',
    beforeKey: 'landing.example.en.before',
    afterKey: 'landing.example.en.after',
    noteKey: 'landing.example.en.note',
  },
  {
    lang: 'ko',
    flag: '🇰🇷',
    beforeKey: 'landing.example.ko.before',
    afterKey: 'landing.example.ko.after',
    noteKey: 'landing.example.ko.note',
  },
] as const

const LANGUAGES = [
  { flag: '🇰🇷', code: 'ko' },
  { flag: '🇯🇵', code: 'ja' },
  { flag: '🇨🇳', code: 'zh' },
  { flag: '🇺🇸', code: 'en' },
  { flag: '🇪🇸', code: 'es' },
  { flag: '🇫🇷', code: 'fr' },
]

export default function LandingPage() {
  const { language, t } = useI18n()

  return (
    <div className="min-h-screen bg-surface font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-blue-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {t('landing.skipToContent')}
      </a>

      {/* Navbar */}
      <header>
        <nav aria-label={t('landing.navAria')} className="sticky top-0 z-10 bg-surface/80 backdrop-blur border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between gap-3">
            <span className="text-lg font-bold tracking-tight text-gray-900">
              Tone<span className="text-blue-500">Bridge</span>
            </span>
            <div className="flex items-center gap-2">
              <UiLanguageSwitcher />
              <ThemeToggle className="hidden sm:inline-flex" />
              <Link
                href="/login"
                className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors"
              >
                {t('landing.navCta')}
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <main id="main-content">
      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
            {t('landing.heroTitle').split('\n').map((line, index) => (
              <span key={line}>{line}{index === 0 && <br />}</span>
            ))}
          </h1>
          <p className="mt-5 text-lg text-gray-500 leading-relaxed">
            {t('landing.heroSubtitle').split('\n').map((line, index) => (
              <span key={line}>{line}{index === 0 && <br />}</span>
            ))}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="px-6 py-3.5 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
            >
              {t('landing.startFree')}
            </Link>
            <Link
              href="/community"
              className="px-6 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              {t('landing.browseFeed')} →
            </Link>
          </div>
          <InstallBanner className="mt-6 text-left max-w-sm mx-auto" />
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 text-center mb-12">
            {t('landing.howTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div key={step.num} className="flex flex-col gap-3">
                <span className="text-sm font-bold text-blue-500 tracking-widest">{step.num}</span>
                <h3 className="text-lg font-bold text-gray-900">{t(step.titleKey)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{t(step.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Correction examples */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 text-center mb-12">
            {t('landing.examplesTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {EXAMPLES.map((ex) => (
              <div
                key={ex.lang}
                className="bg-surface border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col gap-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{ex.flag}</span>
                  <span className="text-sm font-semibold text-gray-700">{languageDisplayName(ex.lang, language)} {t('landing.correctionSuffix')}</span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-start">
                    <span className="shrink-0 mt-0.5 text-xs font-bold text-red-400 w-8">{t('landing.original')}</span>
                    <p className="text-sm text-gray-500 line-through leading-relaxed">{t(ex.beforeKey)}</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="shrink-0 mt-0.5 text-xs font-bold text-green-500 w-8">{t('landing.corrected')}</span>
                    <p className="text-sm text-gray-900 font-medium leading-relaxed">{t(ex.afterKey)}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 leading-relaxed">{t(ex.noteKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Languages */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-400 font-medium mb-5 tracking-wide uppercase">{t('landing.supportedLanguages')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {LANGUAGES.map((lang) => (
              <span
                key={lang.code}
                className="flex items-center gap-1.5 px-4 py-2 bg-surface border border-gray-100 rounded-full text-sm text-gray-700 shadow-sm"
              >
                {lang.flag} {languageDisplayName(lang.code, language)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 bg-blue-50">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            {t('landing.bottomTitle')}
          </h2>
          <p className="mt-3 text-gray-500">{t('landing.bottomSubtitle')}</p>
          <Link
            href="/login"
            className="mt-7 inline-block px-8 py-3.5 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
          >
            {t('landing.startFree')}
          </Link>
        </div>
      </section>

      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100">
        <p className="text-center text-xs text-gray-400">{t('landing.footer')}</p>
      </footer>
    </div>
  )
}
