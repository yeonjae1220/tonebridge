/** Study feedback uses an optional 1–5 scale, separate from community scores. */
export function StudyScore({ score }: { score: number | null | undefined }) {
  if (score == null || !Number.isInteger(score) || score < 1 || score > 5) return null

  const color = score >= 4 ? 'text-green-600' : score === 3 ? 'text-yellow-600' : 'text-red-500'
  return <span className={`text-sm font-bold ${color}`}>{score}/5</span>
}
