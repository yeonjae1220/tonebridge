const UNKNOWN_DATE = '—'

/**
 * API 의 ISO 날짜를 짧은 날짜로. 값이 비었거나 깨졌으면 'Invalid Date' 를 그리거나 던지지 않고
 * '—' 로 강등하되, 강등했다는 사실은 로그로 남긴다(GLOBAL-PIT-135 — 조용한 강등은 그럴듯한 거짓 값이 된다).
 */
export function formatDate(iso: string | null | undefined, locale = 'ko'): string {
  const d = new Date(iso ?? '')
  if (!Number.isFinite(d.getTime())) {
    console.warn(`[formatDate] 날짜로 읽을 수 없는 값 — '${UNKNOWN_DATE}' 로 표시`, iso)
    return UNKNOWN_DATE
  }
  try {
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  } catch (e) {
    // 잘못된 locale 태그는 RangeError 를 던진다 — 날짜 한 줄이 화면 전체를 멈추게 하지 않는다.
    console.warn(`[formatDate] locale '${locale}' 로 포맷 실패 — ISO 날짜로 표시`, e)
    return d.toISOString().slice(0, 10)
  }
}
