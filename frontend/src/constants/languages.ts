export interface Language {
  code: string
  label: string
  flag?: string
}

export const PRIMARY_LANGUAGES: Language[] = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'ja', label: '일본어', flag: '🇯🇵' },
  { code: 'zh', label: '중국어', flag: '🇨🇳' },
  { code: 'en', label: '영어', flag: '🇺🇸' },
  { code: 'es', label: '스페인어', flag: '🇪🇸' },
  { code: 'fr', label: '프랑스어', flag: '🇫🇷' },
  { code: 'de', label: '독일어', flag: '🇩🇪' },
  { code: 'pt', label: '포르투갈어', flag: '🇵🇹' },
  { code: 'ru', label: '러시아어', flag: '🇷🇺' },
]

export const OTHER_LANGUAGES: Language[] = [
  { code: 'ar', label: '아랍어', flag: '🇸🇦' },
  { code: 'hi', label: '힌디어', flag: '🇮🇳' },
  { code: 'tr', label: '터키어', flag: '🇹🇷' },
  { code: 'pl', label: '폴란드어', flag: '🇵🇱' },
  { code: 'nl', label: '네덜란드어', flag: '🇳🇱' },
  { code: 'sv', label: '스웨덴어', flag: '🇸🇪' },
  { code: 'no', label: '노르웨이어', flag: '🇳🇴' },
  { code: 'da', label: '덴마크어', flag: '🇩🇰' },
  { code: 'fi', label: '핀란드어', flag: '🇫🇮' },
  { code: 'cs', label: '체코어', flag: '🇨🇿' },
  { code: 'sk', label: '슬로바키아어', flag: '🇸🇰' },
  { code: 'hu', label: '헝가리어', flag: '🇭🇺' },
  { code: 'ro', label: '루마니아어', flag: '🇷🇴' },
  { code: 'uk', label: '우크라이나어', flag: '🇺🇦' },
  { code: 'el', label: '그리스어', flag: '🇬🇷' },
  { code: 'he', label: '히브리어', flag: '🇮🇱' },
  { code: 'fa', label: '페르시아어', flag: '🇮🇷' },
  { code: 'th', label: '태국어', flag: '🇹🇭' },
  { code: 'vi', label: '베트남어', flag: '🇻🇳' },
  { code: 'id', label: '인도네시아어', flag: '🇮🇩' },
  { code: 'ms', label: '말레이어', flag: '🇲🇾' },
  { code: 'tl', label: '타갈로그어', flag: '🇵🇭' },
  { code: 'bn', label: '벵골어', flag: '🇧🇩' },
  { code: 'ta', label: '타밀어', flag: '🇱🇰' },
  { code: 'ur', label: '우르두어', flag: '🇵🇰' },
  { code: 'sw', label: '스와힐리어', flag: '🇰🇪' },
  { code: 'ca', label: '카탈루냐어', flag: '🏴󠁥󠁳󠁣󠁴󠁿' },
  { code: 'hr', label: '크로아티아어', flag: '🇭🇷' },
  { code: 'sr', label: '세르비아어', flag: '🇷🇸' },
  { code: 'bg', label: '불가리아어', flag: '🇧🇬' },
]

export const ALL_LANGUAGES: Language[] = [...PRIMARY_LANGUAGES, ...OTHER_LANGUAGES]

export const ALL_LANG_LABELS: Record<string, string> = Object.fromEntries(
  ALL_LANGUAGES.map((l) => [l.code, l.label])
)
