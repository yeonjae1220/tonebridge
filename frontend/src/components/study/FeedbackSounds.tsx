'use client'

import { useId } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { languageDisplayName } from '@/i18n/messages'
import { MAX_FEEDBACK_SOUNDS, soundGuideById, soundGuideLabels, soundGuideText, soundGuidesByLanguage } from '@/lib/soundGuides'
import { SoundGuideDetails } from './SoundGuidePanel'

/** Lets the person giving feedback point at up to three sounds, grouped by the language they belong to. */
export function FeedbackSoundPicker({ selected, onChange, preferredLanguages, disabled }: {
  selected: readonly string[]
  onChange: (guideIds: string[]) => void
  /** Languages to list first, e.g. the reviewer's native and fluent languages. */
  preferredLanguages: readonly string[]
  disabled: boolean
}) {
  const { language } = useI18n()
  const labels = soundGuideLabels(language)
  const helpId = useId()
  const full = selected.length >= MAX_FEEDBACK_SOUNDS
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id])

  return (
    <fieldset aria-describedby={helpId} className="space-y-2">
      <legend className="text-xs font-semibold text-gray-700">{labels.feedbackPicker}</legend>
      <p id={helpId} className="text-xs text-gray-500">{full ? labels.feedbackPickerLimit : labels.feedbackPickerHelp}</p>
      {soundGuidesByLanguage(preferredLanguages).map((group) => (
        <div key={group.language} role="group" aria-label={languageDisplayName(group.language, language)} className="flex flex-wrap items-center gap-2">
          <span className="w-full text-xs text-gray-500">{languageDisplayName(group.language, language)}</span>
          {group.guides.map((guide) => {
            const pressed = selected.includes(guide.id)
            return (
              <button
                key={guide.id}
                type="button"
                aria-pressed={pressed}
                // Removing is always allowed; adding stops at the limit.
                disabled={disabled || (!pressed && full)}
                onClick={() => toggle(guide.id)}
                className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 ${pressed ? 'border-action-primary bg-action-primary text-white' : 'border-gray-200 bg-surface text-gray-700 hover:bg-gray-50'}`}
              >
                {soundGuideText(guide, language).title}
              </button>
            )
          })}
        </div>
      ))}
    </fieldset>
  )
}

/** The guides a piece of feedback points at, kept visibly apart from the friend's own words. */
export function FeedbackSoundTargets({ guideIds }: { guideIds: readonly string[] }) {
  const { language } = useI18n()
  const labels = soundGuideLabels(language)
  // Ids the web no longer knows (a retired guide) are skipped rather than shown as raw text.
  const guides = guideIds.map(soundGuideById).filter((guide) => guide !== undefined)
  if (guides.length === 0) return null
  return (
    <div className="mt-3 space-y-2" data-feedback-sounds>
      <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-700">
        {labels.pointedSounds}
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">{labels.beta}</span>
      </p>
      {guides.map((guide) => <SoundGuideDetails key={guide.id} guide={guide} />)}
    </div>
  )
}
