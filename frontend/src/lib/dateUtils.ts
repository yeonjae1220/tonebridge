export function formatDate(iso: string, locale = 'ko') {
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}
