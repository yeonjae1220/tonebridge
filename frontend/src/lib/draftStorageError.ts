export type DraftStorageIssue = 'quota' | 'blocked' | 'conflict' | 'corrupt' | 'unavailable'

export class DraftStorageError extends Error {
  constructor(public readonly issue: DraftStorageIssue) { super(issue) }
}

export function draftStorageIssue(error: unknown): DraftStorageIssue {
  if (error instanceof DraftStorageError) return error.issue
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') return 'quota'
    if (error.name === 'SecurityError' || error.name === 'NotAllowedError') return 'blocked'
  }
  if (error instanceof SyntaxError) return 'corrupt'
  return 'unavailable'
}
