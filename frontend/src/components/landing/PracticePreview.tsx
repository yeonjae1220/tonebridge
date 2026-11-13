'use client'
import { useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
export function PracticePreview() {
  const { t } = useI18n()
  const [feedback, setFeedback] = useState(false)
  return <article className="mb-8 rounded-2xl border border-blue-100 bg-surface p-5">
    <h3 className="text-lg font-bold text-gray-900">{t('access.sample')}</h3>
    <p className="mt-2 text-sm text-gray-500">{t('access.sampleHelp')}</p>
    <p lang="en" className="my-4 text-xl font-semibold text-gray-900">Could you say that again, please?</p>
    <audio aria-label={t('common.play')} controls preload="metadata" src="/samples/practice-example.wav" className="w-full" />
    <button type="button" aria-expanded={feedback} onClick={() => setFeedback(!feedback)} className="mt-4 min-h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-blue-600">{t('access.sampleFeedback')}</button>
    {feedback && <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">{t('access.sampleNote')}</p>}
  </article>
}
