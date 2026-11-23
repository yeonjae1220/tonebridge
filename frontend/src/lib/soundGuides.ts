import type { UiLanguage } from '@/i18n/messages'

export type Point = readonly [number, number]

/** How the tongue relates to the marked spot: held contact, a single quick tap, or close without touching. */
export type ContactKind = 'touch' | 'tap' | 'near'

/**
 * Tongue outline in the diagram's coordinate space (viewBox 0 0 220 200, face pointing left).
 * Order: tip, blade, dorsum, back, root, base, underside, underside front.
 */
export type TonguePose = readonly [Point, Point, Point, Point, Point, Point, Point, Point]

type GuideLanguage = Extract<UiLanguage, 'ko' | 'en' | 'ja'>

interface GuideText {
  title: string
  steps: readonly string[]
}

export interface SoundGuide {
  id: string
  /** Language the sound belongs to (BCP 47 primary subtag). Separate from the language the steps are written in. */
  targetLanguage: string
  symbol: string
  /** True when the symbol is a lowercase-height glyph (like ɹ) that looks undersized next to the others. */
  shortSymbol?: boolean
  /** Normalized card tags that open this guide. */
  aliases: readonly string[]
  tongue: TonguePose
  contact: { at: Point; kind: ContactKind }
  text: Record<GuideLanguage, GuideText>
}

import guideData from './soundGuides.json'

/**
 * Guides come from soundGuides.json, the single source shared with the backend allow-list and the
 * mobile app (each side's tests compare against it). The JSON is checked here at load so a malformed
 * edit fails loudly instead of drawing a broken diagram.
 */
const CONTACT_KINDS: readonly ContactKind[] = ['touch', 'tap', 'near']

function point(value: unknown, where: string): Point {
  if (!Array.isArray(value) || value.length !== 2 || !value.every((n) => typeof n === 'number')) {
    throw new Error(`soundGuides.json: ${where} must be [x, y]`)
  }
  return [value[0], value[1]]
}

function pose(value: unknown, where: string): TonguePose {
  if (!Array.isArray(value) || value.length !== 8) throw new Error(`soundGuides.json: ${where} needs 8 points`)
  return value.map((p, i) => point(p, `${where}[${i}]`)) as unknown as TonguePose
}

export const REST_TONGUE: TonguePose = pose(guideData.restTongue, 'restTongue')

export const SOUND_GUIDES: readonly SoundGuide[] = guideData.guides.map((g) => {
  const kind = g.contact.kind as ContactKind
  if (!CONTACT_KINDS.includes(kind)) throw new Error(`soundGuides.json: ${g.id} has unknown contact kind ${g.contact.kind}`)
  return {
    id: g.id,
    targetLanguage: g.targetLanguage,
    symbol: g.symbol,
    shortSymbol: 'shortSymbol' in g ? Boolean(g.shortSymbol) : undefined,
    aliases: g.aliases,
    tongue: pose(g.tongue, `${g.id}.tongue`),
    contact: { at: point(g.contact.at, `${g.id}.contact.at`), kind },
    text: g.text,
  }
})

const LABELS: Record<GuideLanguage, { heading: string; beta: string; betaNote: string; diagram: string; rest: string; picker: string; pickerToggle: string; pickerHelp: string; feedbackPicker: string; feedbackPickerHelp: string; feedbackPickerLimit: string; pointedSounds: string } & Record<ContactKind, string>> = {
  ko: { heading: '발음 가이드', beta: '베타', betaNote: '그림과 설명은 아직 검수 중이에요. 참고용으로 봐 주세요.', diagram: '입 안 옆모습', rest: '점선: 쉴 때의 혀', picker: '입 모양 그림 붙이기', pickerToggle: '입 모양', pickerHelp: '어려운 소리를 고르면 카드에 입 안 그림과 설명이 함께 보여요.', feedbackPicker: '짚을 소리 (선택)', feedbackPickerHelp: '고른 소리의 입 모양 그림이 피드백과 함께 보여요.', feedbackPickerLimit: '소리는 3개까지 고를 수 있어요.', pointedSounds: '피드백에서 짚은 소리', touch: '혀끝이 닿는 곳', tap: '혀끝이 한 번 치는 곳', near: '닿지 않고 가까이 가는 곳' },
  en: { heading: 'Pronunciation guide', beta: 'Beta', betaNote: 'These diagrams and tips are still being reviewed. Use them as a rough guide.', diagram: 'side view of the mouth', rest: 'Dashed: tongue at rest', picker: 'Add a mouth diagram', pickerToggle: 'Mouth', pickerHelp: 'Pick a tricky sound to show a mouth diagram and tips on the card.', feedbackPicker: 'Sounds to point out (optional)', feedbackPickerHelp: 'A mouth diagram for each sound is shown with your feedback.', feedbackPickerLimit: 'You can pick up to 3 sounds.', pointedSounds: 'Sounds pointed out in feedback', touch: 'Where the tongue tip touches', tap: 'Where the tongue tip taps once', near: 'Close, but not touching' },
  ja: { heading: '発音ガイド', beta: 'ベータ', betaNote: '図と説明はまだ確認中です。参考としてご覧ください。', diagram: '口の中の横顔', rest: '点線：休んでいるときの舌', picker: '口の形の図を付ける', pickerToggle: '口の形', pickerHelp: '難しい音を選ぶと、カードに口の中の図と説明が表示されます。', feedbackPicker: '指摘する音（任意）', feedbackPickerHelp: '選んだ音の口の形の図がフィードバックと一緒に表示されます。', feedbackPickerLimit: '音は3つまで選べます。', pointedSounds: 'フィードバックで指摘された音', touch: '舌先が付く場所', tap: '舌先が一度はじく場所', near: '付けずに近づける場所' },
}

function guideLanguage(language: UiLanguage): GuideLanguage {
  return language === 'ko' || language === 'ja' ? language : 'en'
}

/** Folds case, width and jamo variants, and drops decoration such as "#th", "/r/" or "(l)". */
function normalizeTag(tag: string): string {
  return tag.normalize('NFKC').toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

function splitTags(tagText: string): string[] {
  return tagText.split(',').map((tag) => tag.trim()).filter(Boolean)
}

function matchesGuide(guide: SoundGuide, tag: string): boolean {
  const normalized = normalizeTag(tag)
  return guide.aliases.some((alias) => normalizeTag(alias) === normalized)
}

export function hasSoundTag(tagText: string, guide: SoundGuide): boolean {
  return splitTags(tagText).some((tag) => matchesGuide(guide, tag))
}

/**
 * Adds the guide's tag to a comma-separated tag string, or removes it if already present.
 * Everything else the user typed is left exactly as written.
 */
export function toggleSoundTag(tagText: string, guide: SoundGuide): string {
  const segments = tagText.split(',')
  if (segments.some((segment) => matchesGuide(guide, segment))) {
    return segments.filter((segment) => !matchesGuide(guide, segment)).join(',').trimStart()
  }
  const kept = tagText.replace(/[,\s]+$/, '')
  return kept ? `${kept}, ${guide.aliases[0]}` : guide.aliases[0]
}

export function findSoundGuides(tags: readonly string[]): SoundGuide[] {
  return SOUND_GUIDES.filter((guide) => tags.some((tag) => matchesGuide(guide, tag)))
}

export function soundGuideText(guide: SoundGuide, language: UiLanguage): GuideText {
  return guide.text[guideLanguage(language)]
}

export function soundGuideLabels(language: UiLanguage): (typeof LABELS)[GuideLanguage] {
  return LABELS[guideLanguage(language)]
}

/** Sounds a single piece of feedback may point at; the server enforces the same limit. */
export const MAX_FEEDBACK_SOUNDS = 3

export function soundGuideById(id: string): SoundGuide | undefined {
  return SOUND_GUIDES.find((guide) => guide.id === id)
}

/**
 * Guides grouped by the language the sound belongs to. Languages listed in {@code preferred}
 * (for example the reviewer's native and fluent languages) come first, in that order.
 */
export function soundGuidesByLanguage(preferred: readonly string[]): { language: string; guides: SoundGuide[] }[] {
  const languages = [...new Set(SOUND_GUIDES.map((guide) => guide.targetLanguage))]
  const rank = (language: string) => {
    const index = preferred.indexOf(language)
    return index < 0 ? preferred.length : index
  }
  return languages
    .sort((a, b) => rank(a) - rank(b))
    .map((language) => ({ language, guides: SOUND_GUIDES.filter((guide) => guide.targetLanguage === language) }))
}
