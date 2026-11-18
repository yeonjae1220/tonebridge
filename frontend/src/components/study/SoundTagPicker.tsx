'use client'

import { useI18n } from '@/i18n/I18nProvider'
import { SOUND_GUIDES, hasSoundTag, soundGuideLabels, soundGuideText, toggleSoundTag } from '@/lib/soundGuides'

interface SoundTagPickerProps {
  /** Comma-separated tags, as typed in the card form. */
  tagText: string
  onChange: (tagText: string) => void
}

/** Toggle buttons that add or remove the tags which open a pronunciation guide on the card. */
export function SoundTagPicker({ tagText, onChange }: SoundTagPickerProps) {
  const { language } = useI18n()
  const labels = soundGuideLabels(language)

  return (
    <div role="group" aria-labelledby="sound-tag-picker-label" className="flex flex-col gap-2">
      <div>
        <p id="sound-tag-picker-label" className="text-xs font-semibold text-gray-500">{labels.picker}</p>
        <p className="mt-0.5 text-xs text-gray-500">{labels.pickerHelp}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SOUND_GUIDES.map((guide) => {
          const selected = hasSoundTag(tagText, guide)
          return (
            <button
              key={guide.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(toggleSoundTag(tagText, guide))}
              className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${selected ? 'border-action-primary bg-action-primary text-white' : 'border-gray-200 bg-surface text-gray-700 hover:bg-gray-50'}`}
            >
              {soundGuideText(guide, language).title}
            </button>
          )
        })}
      </div>
    </div>
  )
}
