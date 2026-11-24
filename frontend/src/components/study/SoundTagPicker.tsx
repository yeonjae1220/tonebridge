'use client'

import { useId, useState, type ReactNode } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { MAX_CARD_TAGS, cardTagsWithinLimits, parseCardTags } from '@/lib/cardLimits'
import { SOUND_GUIDES, hasSoundTag, soundGuideLabels, soundGuideText, toggleSoundTag } from '@/lib/soundGuides'

interface SoundTagPickerProps {
  /** Comma-separated tags, as typed in the card form. */
  tagText: string
  onChange: (tagText: string) => void
  /** The tag text input; the toggle sits beside it so the collapsed picker adds no height to the form. */
  children: ReactNode
}

/** Wraps the tag input with toggle buttons that add or remove the tags which open a pronunciation guide. */
export function SoundTagPicker({ tagText, onChange, children }: SoundTagPickerProps) {
  const { language, t } = useI18n()
  const tags = parseCardTags(tagText)
  const labels = soundGuideLabels(language)
  const panelId = useId()
  // Derived until the user decides: tags can arrive after mount (a restored draft), and a card that
  // already has a sound tag should show its buttons. Null means the user has not chosen yet.
  const [chosenOpen, setChosenOpen] = useState<boolean | null>(null)
  const open = chosenOpen ?? SOUND_GUIDES.some((guide) => hasSoundTag(tagText, guide))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        <button
          type="button"
          aria-label={labels.picker}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setChosenOpen(!open)}
          className={`min-h-11 shrink-0 rounded-xl border px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${open ? 'border-action-primary text-action-primary' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
        >
          {labels.pickerToggle}
        </button>
      </div>
      {!cardTagsWithinLimits(tags) && <p role="alert" className="text-xs text-red-600">{t('study.cards.tagLimit')}</p>}
      {open && (
        <div id={panelId} role="group" aria-label={labels.picker} className="flex flex-col gap-2">
          <p className="text-xs text-gray-500">{labels.pickerHelp}</p>
          <div className="flex flex-wrap gap-2">
            {SOUND_GUIDES.map((guide) => {
              const selected = hasSoundTag(tagText, guide)
              return (
                <button
                  key={guide.id}
                  type="button"
                  aria-pressed={selected}
                  // Adding one more would exceed the limit; removing is always allowed.
                  disabled={!selected && tags.length >= MAX_CARD_TAGS}
                  onClick={() => {
                    // Keep the buttons in place even if this removes the last sound tag.
                    setChosenOpen(true)
                    onChange(toggleSoundTag(tagText, guide))
                  }}
                  className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${selected ? 'border-action-primary bg-action-primary text-white' : 'border-gray-200 bg-surface text-gray-700 hover:bg-gray-50'} disabled:opacity-40`}
                >
                  {soundGuideText(guide, language).title}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
