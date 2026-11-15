import type { TimestampComment } from '@/types'

export type FeedbackDraftValue = {
  kind: 'feedback'; correctedText: string; explanation: string; selectedTags: string[]
  timestampComments: (TimestampComment & { id: string })[]; pendingComment: string; pendingCategory: string
  pronunciationScore: number; intonationScore: number; fluencyScore: number
}
export const EMPTY_FEEDBACK: FeedbackDraftValue = { kind: 'feedback', correctedText: '', explanation: '', selectedTags: [], timestampComments: [], pendingComment: '', pendingCategory: '발음', pronunciationScore: 5, intonationScore: 5, fluencyScore: 5 }
const text = (v: unknown, max = 10000) => typeof v === 'string' && v.length <= max
const score = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 10
const tags = (v: unknown) => Array.isArray(v) && v.length <= 20 && v.every(tag => text(tag, 100))
export function validFeedback(value: unknown): value is FeedbackDraftValue {
  const v = value as FeedbackDraftValue
  return !!v && v.kind === 'feedback' && text(v.correctedText) && text(v.explanation) && text(v.pendingComment) && text(v.pendingCategory, 100)
    && tags(v.selectedTags) && score(v.pronunciationScore) && score(v.intonationScore) && score(v.fluencyScore)
    && Array.isArray(v.timestampComments) && v.timestampComments.length <= 200 && v.timestampComments.every(c => c && text(c.id, 100)
      && Number.isFinite(c.start) && c.start >= 0 && Number.isFinite(c.end) && c.end >= c.start && text(c.comment) && text(c.category, 100))
}
export type CardDraftValue = { kind: 'card'; sessionId: string; phrase: string; context: string; tags: string[]; tagText?: string }
export function validCardDraft(value: unknown): value is CardDraftValue {
  const v = value as CardDraftValue
  return !!v && v.kind === 'card' && text(v.sessionId, 100) && text(v.phrase, 500) && text(v.context) && tags(v.tags) && (v.tagText === undefined || text(v.tagText, 2200))
}
export type SubmissionResult = { type: 'correction' | 'card' | 'cancelled' | 'unavailable'; resourceId: string | null; parentId: string | null }
