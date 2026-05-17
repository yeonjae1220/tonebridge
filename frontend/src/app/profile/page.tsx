'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import type { UserProfile } from '@/types'

const LANG_LABELS: Record<string, string> = {
  ko: '한국어', ja: '일본어', zh: '중국어', en: '영어', es: '스페인어', fr: '프랑스어',
}

const LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
  NATIVE: { label: '원어민', color: 'text-blue-700', bg: 'bg-blue-50' },
  VERIFIED_CORRECTOR: { label: '인증 교정자', color: 'text-purple-700', bg: 'bg-purple-50' },
  EXPERT_COACH: { label: '전문 코치', color: 'text-amber-700', bg: 'bg-amber-50' },
}

const BADGE_META: Record<string, { label: string; icon: string; desc: string }> = {
  STREAK_7DAY: { label: '7일 스트릭', icon: '🔥', desc: '7일 연속 교정 달성' },
  FAST_RESPONDER: { label: '빠른 응답', icon: '⚡', desc: '60분 이내 교정 5회 달성' },
  AUDIO_EXPERT: { label: '음성 전문가', icon: '🎙', desc: '음성 교정 10회 달성' },
}

function ReputationBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 10) * 100)
  const color =
    score >= 8 ? 'bg-green-500' : score >= 6 ? 'bg-blue-500' : score >= 4 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-800 w-8 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/me/profile').then((r) => r.data),
    enabled: !!accessToken,
  })

  if (!accessToken) return null

  const levelMeta = profile ? (LEVEL_META[profile.correctorLevel] ?? LEVEL_META.NATIVE) : null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="뒤로가기"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">내 프로필</h1>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {profile && (
          <div className="flex flex-col gap-4">
            {/* 기본 정보 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xl font-bold text-gray-900">{profile.username}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {LANG_LABELS[profile.nativeLanguage] ?? profile.nativeLanguage} 원어민
                  </p>
                </div>
                {levelMeta && (
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${levelMeta.bg} ${levelMeta.color}`}>
                    {levelMeta.label}
                  </span>
                )}
              </div>
              {profile.fluentLanguages.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.fluentLanguages.map((lang) => (
                    <span key={lang} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {LANG_LABELS[lang] ?? lang}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 스트릭 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-500 mb-3">연속 교정 스트릭</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-orange-500">{profile.correctionStreak}</span>
                <span className="text-base font-semibold text-gray-500 mb-1">일 연속</span>
                {profile.correctionStreak >= 7 && (
                  <span className="ml-auto text-2xl" title="7일 스트릭 달성">🔥</span>
                )}
              </div>
              {profile.correctionStreak === 0 ? (
                <p className="text-xs text-gray-400 mt-2">오늘 교정을 시작해서 스트릭을 쌓으세요!</p>
              ) : profile.correctionStreak > 0 && profile.correctionStreak % 7 === 0 ? (
                <p className="text-xs text-orange-600 mt-2 font-medium">
                  🎉 {profile.correctionStreak}일 달성! 보너스 크레딧이 지급됐어요.
                </p>
              ) : null}
            </div>

            {/* 신뢰도 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-500 mb-3">교정 신뢰도</p>
              <ReputationBar score={profile.reputationScore} />
              <p className="text-xs text-gray-400 mt-2">
                최근 교정에 대한 &apos;도움됨&apos; 평가를 기반으로 산정됩니다.
              </p>
            </div>

            {/* 뱃지 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-500 mb-3">획득한 뱃지</p>
              {profile.badges.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-3xl mb-2">🏅</p>
                  <p className="text-sm">아직 획득한 뱃지가 없어요</p>
                  <p className="text-xs mt-1">교정 활동으로 뱃지를 모아보세요!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {profile.badges.map((badge) => {
                    const meta = BADGE_META[badge.badgeType]
                    if (!meta) return null
                    return (
                      <div key={badge.badgeType} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <span className="text-2xl">{meta.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
                          <p className="text-xs text-gray-500">{meta.desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {profile.badges.length < Object.keys(BADGE_META).length && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 mb-2">획득 가능한 뱃지</p>
                  <div className="flex flex-col gap-2">
                    {Object.entries(BADGE_META)
                      .filter(([key]) => !profile.badges.some((b) => b.badgeType === key))
                      .map(([key, meta]) => (
                        <div key={key} className="flex items-center gap-3 p-3 opacity-40 grayscale">
                          <span className="text-2xl">{meta.icon}</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
                            <p className="text-xs text-gray-500">{meta.desc}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => router.push('/feed')}
              className="w-full py-3 bg-blue-500 text-white font-semibold rounded-2xl hover:bg-blue-600 transition-colors"
            >
              첨삭 피드로 돌아가기
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
