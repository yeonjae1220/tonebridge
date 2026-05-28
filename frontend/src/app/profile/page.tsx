'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api, logout as logoutSession } from '@/lib/api'
import type { UserProfile, User } from '@/types'
import { LanguagePicker } from '@/components/language-picker/LanguagePicker'
import { ALL_LANG_LABELS } from '@/constants/languages'

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

function langLabel(code: string) {
  return ALL_LANG_LABELS[code] ?? code
}

export default function ProfilePage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const queryClient = useQueryClient()

  const [editingLanguages, setEditingLanguages] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [nativeLang, setNativeLang] = useState('')
  const [fluentLangs, setFluentLangs] = useState<string[]>([])
  const [learningLangs, setLearningLangs] = useState<string[]>([])
  const [langError, setLangError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editingNickname, setEditingNickname] = useState(false)
  const [nicknameInput, setNicknameInput] = useState('')
  const [nicknameError, setNicknameError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/me/profile').then((r) => r.data),
    enabled: !!accessToken,
  })

  const { data: me } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    enabled: !!accessToken,
  })

  useEffect(() => {
    if (me && editingLanguages) {
      setNativeLang(me.nativeLanguage)
      setFluentLangs(me.fluentLanguages)
      setLearningLangs(me.learningLanguages)
    }
  }, [me, editingLanguages])

  const updateLangMutation = useMutation({
    mutationFn: () =>
      api.patch('/users/me/languages', {
        nativeLanguage: nativeLang,
        fluentLanguages: fluentLangs,
        learningLanguages: learningLangs,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setEditingLanguages(false)
      setLangError(null)
    },
    onError: () => setLangError('저장에 실패했습니다. 다시 시도해주세요.'),
  })

  const updateNicknameMutation = useMutation({
    mutationFn: (username: string) => api.patch('/users/me/username', { username }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setEditingNickname(false)
      setNicknameError(null)
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err?.response?.status === 409) {
        setNicknameError('이미 사용 중인 닉네임입니다.')
      } else {
        setNicknameError('저장에 실패했습니다. 다시 시도해주세요.')
      }
    },
  })

  const handleNicknameEdit = () => {
    setNicknameInput(profile?.username ?? '')
    setNicknameError(null)
    setEditingNickname(true)
  }

  const handleNicknameSave = () => {
    const trimmed = nicknameInput.trim()
    if (!/^[a-zA-Z0-9_]{2,20}$/.test(trimmed)) {
      setNicknameError('닉네임은 2~20자의 영문, 숫자, 언더스코어만 사용할 수 있습니다.')
      return
    }
    updateNicknameMutation.mutate(trimmed)
  }

  const deleteAccountMutation = useMutation({
    mutationFn: () => api.delete('/users/me'),
    onSuccess: async () => {
      await logoutSession()
      queryClient.clear()
      router.replace('/login')
    },
    onError: () => setDeleteError('회원탈퇴에 실패했습니다. 다시 시도해주세요.'),
  })

  const handleDeleteAccount = () => {
    if (!window.confirm('정말로 탈퇴하시겠습니까?\n탈퇴 후 모든 데이터가 삭제되며 복구할 수 없습니다.')) return
    setDeleteError(null)
    deleteAccountMutation.mutate()
  }

  if (!accessToken) return null

  const levelMeta = profile ? (LEVEL_META[profile.correctorLevel] ?? LEVEL_META.NATIVE) : null

  if (editingLanguages) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setEditingLanguages(false)}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
              aria-label="취소"
            >
              ←
            </button>
            <h1 className="text-xl font-bold text-gray-900">언어 설정 변경</h1>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">모국어</p>
              <LanguagePicker
                value={nativeLang}
                onLanguageChange={setNativeLang}
                showVariantPicker={false}
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">구사 언어 (복수 선택)</p>
              <LanguagePicker
                multiSelect
                value={fluentLangs}
                onLanguageChange={setFluentLangs}
                excludeCodes={[nativeLang]}
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">학습 언어 (복수 선택)</p>
              <LanguagePicker
                multiSelect
                value={learningLangs}
                onLanguageChange={setLearningLangs}
                excludeCodes={[nativeLang]}
              />
            </div>

            {langError && <p className="text-sm text-red-500 text-center">{langError}</p>}

            <button
              onClick={() => updateLangMutation.mutate()}
              disabled={!nativeLang || updateLangMutation.isPending}
              className="w-full py-3 bg-blue-500 text-white font-semibold rounded-2xl hover:bg-blue-600 transition-colors disabled:opacity-40"
            >
              {updateLangMutation.isPending ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (showSettings) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setShowSettings(false)}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
              aria-label="뒤로가기"
            >
              ←
            </button>
            <h1 className="text-2xl font-bold text-gray-900">설정</h1>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button
              onClick={async () => {
                await logoutSession()
                queryClient.clear()
                router.replace('/login')
              }}
              className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span>
                <span className="block text-sm font-semibold text-gray-900">로그아웃</span>
                <span className="block text-xs text-gray-400 mt-0.5">현재 브라우저에서 로그아웃합니다</span>
              </span>
              <span className="text-gray-300">›</span>
            </button>
            <div className="h-px bg-gray-100" />
            <button
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending}
              className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <span>
                <span className="block text-sm font-semibold text-red-600">
                  {deleteAccountMutation.isPending ? '탈퇴 중...' : '회원탈퇴'}
                </span>
                <span className="block text-xs text-gray-400 mt-0.5">확인 후 계정과 데이터를 삭제합니다</span>
              </span>
              <span className="text-red-200">›</span>
            </button>
          </div>
          {deleteError && <p className="mt-3 text-xs text-red-500 text-center">{deleteError}</p>}
        </div>
      </main>
    )
  }

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
          <button
            onClick={() => setShowSettings(true)}
            className="ml-auto p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="설정"
          >
            ⚙
          </button>
        </div>

        {profileLoading && (
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
                <div className="flex-1 min-w-0">
                  {editingNickname ? (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="nickname-input" className="sr-only">닉네임</label>
                      <div className="flex gap-2">
                        <input
                          id="nickname-input"
                          type="text"
                          value={nicknameInput}
                          onChange={(e) => setNicknameInput(e.target.value)}
                          maxLength={20}
                          placeholder="닉네임 (2~20자, 영문/숫자/_)"
                          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400"
                          onKeyDown={(e) => e.key === 'Enter' && handleNicknameSave()}
                          autoFocus
                        />
                        <button
                          onClick={handleNicknameSave}
                          disabled={updateNicknameMutation.isPending}
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 transition-colors"
                        >
                          {updateNicknameMutation.isPending ? '저장...' : '저장'}
                        </button>
                        <button
                          onClick={() => setEditingNickname(false)}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                      {nicknameError && <p className="text-xs text-red-500">{nicknameError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-gray-900 truncate">{profile.username}</p>
                      <button
                        onClick={handleNicknameEdit}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                        aria-label="닉네임 변경"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {!editingNickname && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {langLabel(profile.nativeLanguage)} 원어민
                    </p>
                  )}
                </div>
                {levelMeta && !editingNickname && (
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${levelMeta.bg} ${levelMeta.color} ml-2 flex-shrink-0`}>
                    {levelMeta.label}
                  </span>
                )}
              </div>
              {profile.fluentLanguages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {profile.fluentLanguages.map((lang) => (
                    <span key={lang} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {langLabel(lang)}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => setEditingLanguages(true)}
                className="w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                언어 설정 변경
              </button>
            </div>

            <button
              onClick={() => router.push('/wallet')}
              className="bg-white rounded-2xl border border-gray-100 p-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span>
                <span className="block text-sm font-semibold text-gray-500 mb-1">크레딧 지갑</span>
                <span className="block text-2xl font-black text-blue-600">{me?.credits ?? '—'}</span>
              </span>
              <span className="text-gray-300 text-2xl">›</span>
            </button>

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

          </div>
        )}
      </div>
    </main>
  )
}
