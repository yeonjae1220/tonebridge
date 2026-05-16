export interface User {
  id: string
  email: string
  username: string
  nativeLanguage: string
  fluentLanguages: string[]
  learningLanguages: string[]
  credits: number
  reputationScore: number
  correctorLevel: 'NATIVE' | 'VERIFIED_CORRECTOR' | 'EXPERT_COACH'
  correctionStreak: number
}

export interface CorrectionRequest {
  id: string
  requesterId: string
  type: 'TEXT' | 'AUDIO'
  contentText?: string
  audioUrl?: string
  targetLanguage: string
  context?: string
  feedbackGoals: string[]
  creditCost: number
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'AI_COMPLETED'
  createdAt: string
  expiresAt: string
  availableCorrectors?: number
}

export interface Correction {
  id: string
  requestId: string
  correctorId?: string
  isAi: boolean
  correctedText?: string
  explanation?: string
  tags: string[]
  timestampComments?: TimestampComment[]
  pronunciationScore?: number
  intonationScore?: number
  fluencyScore?: number
  referenceAudioUrl?: string
  creditEarned: number
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  createdAt: string
}

export interface TimestampComment {
  start: number
  end: number
  comment: string
  category: string
}
