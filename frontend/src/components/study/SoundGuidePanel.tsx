'use client'

import { useI18n } from '@/i18n/I18nProvider'
import { findSoundGuides, soundGuideLabels, soundGuideText, type SoundGuide } from '@/lib/soundGuides'
import { ContactSwatch, SagittalDiagram } from './SagittalDiagram'

/** Shows a mouth diagram for each sound a card is tagged with (for example "th" or "ㄹ"). */
export function SoundGuidePanel({ tags }: { tags: readonly string[] }) {
  const { language } = useI18n()
  const guides = findSoundGuides(tags)
  if (guides.length === 0) return null
  const labels = soundGuideLabels(language)

  return (
    <section aria-labelledby="sound-guide-heading" className="bg-surface rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2">
        <h2 id="sound-guide-heading" className="text-sm font-bold text-gray-900">{labels.heading}</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{labels.beta}</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">{labels.betaNote}</p>
      <div className="mt-3 flex flex-col gap-2">
        {guides.map((guide, index) => (
          // Only the first guide starts open so several tagged sounds do not push the recordings off screen.
          <SoundGuideDetails key={guide.id} guide={guide} defaultOpen={index === 0} />
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">{labels.rest}</p>
    </section>
  )
}

/** One collapsible guide: symbol and title, then the mouth diagram and steps when opened. */
export function SoundGuideDetails({ guide, defaultOpen = false }: { guide: SoundGuide; defaultOpen?: boolean }) {
  const { language } = useI18n()
  const labels = soundGuideLabels(language)
  const text = soundGuideText(guide, language)
  return (
    <details data-sound-guide={guide.id} open={defaultOpen} className="group rounded-xl border border-gray-100 bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [&::-webkit-details-marker]:hidden">
        <span className={`w-7 text-center font-black leading-none text-action-primary ${guide.shortSymbol ? '-translate-y-1 text-3xl' : 'text-xl'}`}>{guide.symbol}</span>
        <span className="flex-1 text-sm font-semibold text-gray-900">{text.title}</span>
        <span aria-hidden="true" className="text-gray-500 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3 sm:flex-row sm:items-start">
        <SagittalDiagram
          tongue={guide.tongue}
          contact={guide.contact}
          label={`${text.title} — ${labels.diagram}`}
          className="h-44 w-48 shrink-0 self-center rounded-xl bg-gray-50 sm:self-start"
        />
        <div className="min-w-0 flex-1">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
            {text.steps.map((step, stepIndex) => <li key={`${stepIndex}-${step}`}>{step}</li>)}
          </ol>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
            <ContactSwatch kind={guide.contact.kind} />
            {labels[guide.contact.kind]}
          </p>
        </div>
      </div>
    </details>
  )
}
