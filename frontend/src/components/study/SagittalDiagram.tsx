import { REST_TONGUE, type ContactKind, type Point, type TonguePose } from '@/lib/soundGuides'

const SMOOTHING = 6

/** Closed Catmull-Rom spline through the points, expressed as cubic Béziers. */
function smoothClosedPath(points: readonly Point[]): string {
  const count = points.length
  const at = (index: number) => points[(index + count) % count]
  const segments = points.map((point, index) => {
    const previous = at(index - 1)
    const next = at(index + 1)
    const afterNext = at(index + 2)
    const c1 = [point[0] + (next[0] - previous[0]) / SMOOTHING, point[1] + (next[1] - previous[1]) / SMOOTHING]
    const c2 = [next[0] - (afterNext[0] - point[0]) / SMOOTHING, next[1] - (afterNext[1] - point[1]) / SMOOTHING]
    return `C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${next[0]} ${next[1]}`
  })
  return `M ${points[0][0]} ${points[0][1]} ${segments.join(' ')} Z`
}

interface SagittalDiagramProps {
  tongue: TonguePose
  contact: { at: Point; kind: ContactKind }
  label: string
  className?: string
}

/** Mid-sagittal (side) section of the mouth, face pointing left. */
export function SagittalDiagram({ tongue, contact, label, className }: SagittalDiagramProps) {
  const [cx, cy] = contact.at
  return (
    <svg viewBox="0 0 220 200" role="img" aria-label={label} className={className}>
      <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
        {/* forehead, nose, upper lip */}
        <path d="M 70 6 C 52 28 46 48 44 60 L 24 80 Q 22 87 32 88 L 44 90 Q 34 96 36 104 Q 39 111 52 110" />
        {/* lower lip, chin, underside of the jaw */}
        <path d="M 52 118 Q 38 118 38 126 Q 38 134 48 138 Q 40 150 48 164 Q 56 178 84 182 L 120 186" />
        {/* back wall of the throat */}
        <path d="M 190 60 L 190 190" />
      </g>

      <path d={smoothClosedPath(REST_TONGUE)} fill="none" strokeWidth="1.5" strokeDasharray="4 4" className="stroke-gray-400" />
      <path data-tongue d={smoothClosedPath(tongue)} strokeWidth="2" strokeLinejoin="round" className="fill-pink-300 stroke-pink-600" />

      <g strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
        {/* gum ridge, hard palate, raised soft palate */}
        <path d="M 68 98 Q 76 92 84 94 C 96 84 110 76 126 76 C 140 76 150 82 156 88 C 166 92 176 92 186 98" fill="none" stroke="currentColor" strokeWidth="4" />
        {/* upper and lower front teeth */}
        <path d="M 62 98 L 68 98 L 67 114 L 63 112 Z" stroke="currentColor" strokeWidth="1.5" className="fill-surface" />
        <path d="M 69 136 L 75 136 L 73 120 L 70 121 Z" stroke="currentColor" strokeWidth="1.5" className="fill-surface" />
      </g>

      {contact.kind === 'near' ? (
        <circle cx={cx} cy={cy} r="5" fill="none" strokeWidth="2.5" strokeDasharray="3 2.5" className="stroke-action-primary" />
      ) : (
        <>
          {contact.kind === 'tap' && (
            <circle cx={cx} cy={cy} r="5" fill="none" strokeWidth="2" className="origin-center animate-ping stroke-action-primary [animation-iteration-count:3] [transform-box:fill-box] motion-reduce:animate-none" />
          )}
          <circle cx={cx} cy={cy} r="5" strokeWidth="2" className="fill-action-primary stroke-surface" />
        </>
      )}
    </svg>
  )
}

export function ContactSwatch({ kind }: { kind: ContactKind }) {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" className="h-3.5 w-3.5 shrink-0">
      {kind === 'near'
        ? <circle cx="7" cy="7" r="5" fill="none" strokeWidth="2" strokeDasharray="3 2.5" className="stroke-action-primary" />
        : <circle cx="7" cy="7" r="5" className="fill-action-primary" />}
    </svg>
  )
}
