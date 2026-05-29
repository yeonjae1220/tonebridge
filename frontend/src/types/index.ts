export type BadgeType = 'STREAK_7DAY' | 'FAST_RESPONDER' | 'AUDIO_EXPERT'

export interface UserBadge {
  badgeType: BadgeType
  awardedAt: string
}

export interface User {
  id: string
  email: string
  username: string
  nativeLanguage: string
  uiLanguage: string
  nativeDialect?: string | null
  fluentLanguages: string[]
  learningLanguages: string[]
  fluentLanguageVariants?: Record<string, string>
  learningLanguageVariants?: Record<string, string>
  credits: number
  reputationScore: number
  correctorLevel: 'NATIVE' | 'VERIFIED_CORRECTOR' | 'EXPERT_COACH'
  correctionStreak: number
  lastCorrectionDate?: string
}

export interface UserProfile {
  id: string
  username: string
  nativeLanguage: string
  uiLanguage: string
  fluentLanguages: string[]
  correctionStreak: number
  reputationScore: number
  correctorLevel: 'NATIVE' | 'VERIFIED_CORRECTOR' | 'EXPERT_COACH'
  badges: UserBadge[]
}

export interface CorrectionRequest {
  id: string
  requesterId: string
  type: 'TEXT' | 'AUDIO'
  contentText?: string
  audioUrl?: string
  targetLanguage: string
  targetVariant?: string
  context?: string
  feedbackGoals: string[]
  creditCost: number
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'AI_COMPLETED'
  createdAt: string
  expiresAt: string
  updatedAt?: string
  deletedAt?: string | null
  editCount?: number
  availableCorrectors?: number
  acceptedCorrectionId?: string | null
}

export interface LanguageVariant {
  code: string
  parentCode: string
  label: string
  labelNative: string
  variantType: 'DIALECT' | 'ACCENT' | 'SCRIPT'
  region: string
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
  updatedAt?: string
  deletedAt?: string | null
  editCount?: number
  likeCount: number
  likedByMe: boolean
  isAccepted: boolean
}

export interface TimestampComment {
  start: number
  end: number
  comment: string
  category: string
}

export interface AdminStats {
  totalRequests: number
  pendingRequests: number
  completedRequests: number
  qualityPassRate: number
  pendingByLanguage: Record<string, number>
}

export interface AdminUserSummary {
  id: string
  email: string
  username: string
  nativeLanguage: string
  credits: number
  reputationScore: number
  correctionStreak: number
  isAdmin: boolean
  createdAt: string
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface UserSearchResult {
  id: string
  username: string
  nativeLanguage: string
}

export interface Friend {
  id: string
  username: string
  nativeLanguage: string
}

export interface FriendRequest {
  id: string
  senderId: string
  receiverId: string
  status: 'PENDING' | 'ACCEPTED' | 'BLOCKED'
  senderUsername: string | null
  createdAt: string
}

export interface StudySession {
  id: string
  title: string | null
  createdBy: string
  memberIds: string[]
  status: 'ACTIVE' | 'ENDED'
  createdAt: string
  updatedAt?: string
  deletedAt?: string | null
}

export interface LearnerAttempt {
  id: string
  cardId: string
  learnerId: string
  audioUrl: string | null
  correctionNote: string | null
  score: number | null
  attemptedAt: string
}

export interface StudyCard {
  id: string
  sessionId: string
  createdByUserId: string
  phrase: string
  context: string | null
  nativeAudioUrl: string | null
  explanation: string | null
  tags: string[]
  position: number
  createdAt: string
  latestAttempt: LearnerAttempt | null
  note?: string | null
  updatedAt?: string
  deletedAt?: string | null
  editCount?: number
}

export interface NativeAudioEntry {
  id: string
  cardId: string
  createdAt: string
  note: string | null
}
