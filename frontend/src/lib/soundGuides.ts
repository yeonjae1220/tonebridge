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
  symbol: string
  /** Normalized card tags that open this guide. */
  aliases: readonly string[]
  tongue: TonguePose
  contact: { at: Point; kind: ContactKind }
  text: Record<GuideLanguage, GuideText>
}

export const REST_TONGUE: TonguePose = [
  [80, 124], [98, 112], [128, 104], [160, 116], [172, 150], [150, 176], [110, 168], [86, 142],
]

export const SOUND_GUIDES: readonly SoundGuide[] = [
  {
    id: 'en-th',
    symbol: 'θ',
    aliases: ['th', 'θ', 'ð'],
    tongue: [[61, 117], [84, 111], [126, 106], [160, 118], [172, 150], [150, 176], [108, 168], [78, 126]],
    contact: { at: [64, 115], kind: 'touch' },
    text: {
      ko: {
        title: '영어 th',
        steps: [
          '혀끝을 윗니와 아랫니 사이로 살짝 내밉니다.',
          '혀를 떼지 않은 채 그 틈으로 바람을 계속 내보냅니다.',
          'think는 목을 울리지 않고, this는 같은 자리에서 목을 울립니다.',
        ],
      },
      en: {
        title: 'English th',
        steps: [
          'Let the tip of your tongue rest lightly between your upper and lower teeth.',
          'Keep it there and push air through the gap.',
          'No voice for "think"; add voice in the same position for "this".',
        ],
      },
      ja: {
        title: '英語の th',
        steps: [
          '舌先を上下の歯の間に軽く出します。',
          '舌を離さずに、そのすき間から息を出し続けます。',
          'think は声を出さず、this は同じ位置で声を出します。',
        ],
      },
    },
  },
  {
    id: 'en-r',
    symbol: 'ɹ',
    aliases: ['r', 'ɹ'],
    tongue: [[98, 94], [108, 108], [134, 100], [164, 114], [172, 150], [150, 176], [108, 166], [92, 114]],
    contact: { at: [98, 87], kind: 'near' },
    text: {
      ko: {
        title: '영어 r',
        steps: [
          '혀끝을 윗잇몸 뒤쪽으로 들어 올리되 어디에도 닿지 않게 합니다.',
          '혀 양옆은 위쪽 어금니에 가볍게 붙입니다.',
          '입술을 살짝 둥글게 모읍니다. 혀끝이 닿으면 ㄹ처럼 들립니다.',
        ],
      },
      en: {
        title: 'English r',
        steps: [
          'Lift the tip of your tongue toward the area behind the gum ridge without touching anything.',
          'Let the sides of your tongue rest against your upper back teeth.',
          'Round your lips slightly. If the tip touches, it turns into a tap or an l.',
        ],
      },
      ja: {
        title: '英語の r',
        steps: [
          '舌先を上の歯ぐきの後ろへ持ち上げますが、どこにも付けません。',
          '舌の両側は上の奥歯に軽く当てます。',
          '唇を少し丸めます。舌先が付くと「ら行」のように聞こえます。',
        ],
      },
    },
  },
  {
    id: 'en-l',
    symbol: 'l',
    aliases: ['l'],
    tongue: [[80, 97], [94, 108], [128, 110], [160, 120], [172, 150], [150, 176], [110, 168], [88, 122]],
    contact: { at: [80, 95], kind: 'touch' },
    text: {
      ko: {
        title: '영어 l',
        steps: [
          '혀끝을 윗니 바로 뒤 잇몸에 단단히 붙입니다.',
          '혀끝을 붙인 채 소리를 내면 공기가 혀 양옆으로 빠져나갑니다.',
          '소리가 끝날 때까지 혀끝을 떼지 않습니다.',
        ],
      },
      en: {
        title: 'English l',
        steps: [
          'Press the tip of your tongue firmly on the gum ridge just behind your upper teeth.',
          'Voice the sound while it stays there; air flows around the sides of the tongue.',
          'Keep the tip in place until the sound ends.',
        ],
      },
      ja: {
        title: '英語の l',
        steps: [
          '舌先を上の前歯のすぐ後ろの歯ぐきにしっかり付けます。',
          '付けたまま声を出すと、息は舌の両側から抜けます。',
          '音が終わるまで舌先を離しません。',
        ],
      },
    },
  },
  {
    id: 'ko-rieul',
    symbol: 'ㄹ',
    aliases: ['ㄹ', '\u11af', '리을', 'ɾ'],
    tongue: [[81, 97], [95, 109], [128, 108], [160, 118], [172, 150], [150, 176], [110, 168], [88, 124]],
    contact: { at: [81, 95], kind: 'tap' },
    text: {
      ko: {
        title: '한국어 ㄹ',
        steps: [
          '모음 사이(나라, 우리)에서는 혀끝으로 윗잇몸을 한 번 가볍게 치고 바로 뗍니다.',
          '받침(말, 달)에서는 혀끝을 윗잇몸에 붙인 채 유지합니다.',
          '혀를 뒤로 말지 않습니다.',
        ],
      },
      en: {
        title: 'Korean ㄹ',
        steps: [
          'Between vowels (나라, 우리), tap the gum ridge once with the tip of your tongue and release immediately.',
          'At the end of a syllable (말, 달), hold the tip against the gum ridge.',
          'Do not curl the tongue back.',
        ],
      },
      ja: {
        title: '韓国語の ㄹ',
        steps: [
          '母音の間（나라、우리）では、舌先で上の歯ぐきを一度軽くはじいてすぐ離します。',
          'パッチム（말、달）では、舌先を上の歯ぐきに付けたままにします。',
          '舌を後ろに巻きません。',
        ],
      },
    },
  },
]

const LABELS: Record<GuideLanguage, { heading: string; diagram: string; rest: string; picker: string; pickerHelp: string } & Record<ContactKind, string>> = {
  ko: { heading: '발음 가이드', diagram: '입 안 옆모습', rest: '점선: 쉴 때의 혀', picker: '입 모양 그림 붙이기', pickerHelp: '어려운 소리를 고르면 카드에 입 안 그림과 설명이 함께 보여요.', touch: '혀끝이 닿는 곳', tap: '혀끝이 한 번 치는 곳', near: '닿지 않고 가까이 가는 곳' },
  en: { heading: 'Pronunciation guide', diagram: 'side view of the mouth', rest: 'Dashed: tongue at rest', picker: 'Add a mouth diagram', pickerHelp: 'Pick a tricky sound to show a mouth diagram and tips on the card.', touch: 'Where the tongue tip touches', tap: 'Where the tongue tip taps once', near: 'Close, but not touching' },
  ja: { heading: '発音ガイド', diagram: '口の中の横顔', rest: '点線：休んでいるときの舌', picker: '口の形の図を付ける', pickerHelp: '難しい音を選ぶと、カードに口の中の図と説明が表示されます。', touch: '舌先が付く場所', tap: '舌先が一度はじく場所', near: '付けずに近づける場所' },
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

/** Adds the guide's tag to a comma-separated tag string, or removes it if already present. */
export function toggleSoundTag(tagText: string, guide: SoundGuide): string {
  const tags = splitTags(tagText)
  const next = tags.some((tag) => matchesGuide(guide, tag))
    ? tags.filter((tag) => !matchesGuide(guide, tag))
    : [...tags, guide.aliases[0]]
  return next.join(', ')
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
