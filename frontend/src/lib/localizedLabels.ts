import type { MessageKey } from '@/i18n/messages'

type TFunction = (key: MessageKey) => string

const KNOWN_LABEL_KEYS: Record<string, MessageKey> = {
  '발음': 'goal.pronunciation',
  pronunciation: 'goal.pronunciation',
  Pronunciation: 'goal.pronunciation',
  '문법': 'goal.grammar',
  grammar: 'goal.grammar',
  Grammar: 'goal.grammar',
  '자연스러움': 'goal.naturalness',
  naturalness: 'goal.naturalness',
  Naturalness: 'goal.naturalness',
  '억양': 'goal.intonation',
  intonation: 'goal.intonation',
  Intonation: 'goal.intonation',
  '캐주얼': 'goal.casual',
  casual: 'goal.casual',
  Casual: 'goal.casual',
  '비즈니스': 'goal.business',
  business: 'goal.business',
  Business: 'goal.business',
  '원어민 표현': 'correct.tag.native',
  native: 'correct.tag.native',
  'Native expression': 'correct.tag.native',
  '포멀': 'correct.tag.formal',
  formal: 'correct.tag.formal',
  Formal: 'correct.tag.formal',
  '속도': 'correct.category.speed',
  speed: 'correct.category.speed',
  Speed: 'correct.category.speed',
  '강세': 'correct.category.stress',
  stress: 'correct.category.stress',
  Stress: 'correct.category.stress',
  '연음': 'correct.category.liaison',
  liaison: 'correct.category.liaison',
  'Connected speech': 'correct.category.liaison',
}

export function localizedLabel(value: string, t: TFunction) {
  return KNOWN_LABEL_KEYS[value] ? t(KNOWN_LABEL_KEYS[value]) : value
}
