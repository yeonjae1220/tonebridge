'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api, logout as logoutSession } from '@/lib/api'
import type { UserProfile, User } from '@/types'
import { LanguagePicker } from '@/components/language-picker/LanguagePicker'
import { ALL_LANG_LABELS, UI_LANGUAGES } from '@/constants/languages'
import { useI18n } from '@/i18n/I18nProvider'
import { formatMessage, languageDisplayName } from '@/i18n/messages'

const LEVEL_META = {
  NATIVE: { key: 'profile.level.native', color: 'text-blue-700', bg: 'bg-blue-50' },
  VERIFIED_CORRECTOR: { key: 'profile.level.verified', color: 'text-purple-700', bg: 'bg-purple-50' },
  EXPERT_COACH: { key: 'profile.level.expert', color: 'text-amber-700', bg: 'bg-amber-50' },
} as const

const BADGE_META = {
  STREAK_7DAY: { labelKey: 'profile.badge.streak7.label', icon: '🔥', descKey: 'profile.badge.streak7.desc' },
  FAST_RESPONDER: { labelKey: 'profile.badge.fast.label', icon: '⚡', descKey: 'profile.badge.fast.desc' },
  AUDIO_EXPERT: { labelKey: 'profile.badge.audio.label', icon: '🎙', descKey: 'profile.badge.audio.desc' },
} as const

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

function fallbackLangLabel(code: string) {
  return ALL_LANG_LABELS[code] ?? code
}

export default function ProfilePage() {
  const router = useRouter()
  const pathname = usePathname()
  const { accessToken } = useAuthStore()
  const queryClient = useQueryClient()
  const { language, setLanguage, t } = useI18n()

  const [editingLanguages, setEditingLanguages] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [nativeLang, setNativeLang] = useState('')
  const [uiLang, setUiLang] = useState<string>(language)
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

  useEffect(() => {
    setEditingLanguages(pathname === '/profile/language-edit')
    setShowSettings(pathname === '/profile/settings')
  }, [pathname])

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
      setUiLang(me.uiLanguage)
      setFluentLangs(me.fluentLanguages)
      setLearningLangs(me.learningLanguages)
    }
  }, [me, editingLanguages])

  const updateLangMutation = useMutation({
    mutationFn: () =>
      api.patch('/users/me/languages', {
        nativeLanguage: nativeLang,
        uiLanguage: uiLang,
        fluentLanguages: fluentLangs,
        learningLanguages: learningLangs,
        nativeDialect: me?.nativeDialect,
        fluentLanguageVariants: me?.fluentLanguageVariants ?? {},
        learningLanguageVariants: me?.learningLanguageVariants ?? {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setLanguage(uiLang)
      router.push('/profile')
      setLangError(null)
    },
    onError: () => setLangError(t('profile.saveFailed')),
  })

  const updateUiLanguageMutation = useMutation({
    mutationFn: (next: string) => {
      if (!me) throw new Error('User profile is not loaded')
      return api.patch('/users/me/languages', {
        nativeLanguage: me.nativeLanguage,
        uiLanguage: next,
        fluentLanguages: me.fluentLanguages,
        learningLanguages: me.learningLanguages,
        nativeDialect: me.nativeDialect,
        fluentLanguageVariants: me.fluentLanguageVariants ?? {},
        learningLanguageVariants: me.learningLanguageVariants ?? {},
      })
    },
    onMutate: (next) => {
      const previousLanguage = language
      const previousUiLang = uiLang
      setLangError(null)
      setUiLang(next)
      setLanguage(next)
      return { previousLanguage, previousUiLang }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (_error, _next, context) => {
      setUiLang(context?.previousUiLang ?? me?.uiLanguage ?? language)
      setLanguage(context?.previousLanguage ?? me?.uiLanguage ?? language)
      setLangError(t('common.retryLater'))
    },
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
        setNicknameError(t('profile.nicknameTaken'))
      } else {
        setNicknameError(t('profile.saveFailed'))
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
      setNicknameError(t('profile.nicknameInvalid'))
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
    onError: () => setDeleteError(t('profile.deleteFailed')),
  })

  const handleDeleteAccount = () => {
    if (!window.confirm(t('profile.deleteConfirm'))) return
    setDeleteError(null)
    deleteAccountMutation.mutate()
  }

  if (!accessToken) return null

  const levelMeta = profile ? (LEVEL_META[profile.correctorLevel] ?? LEVEL_META.NATIVE) : null
  const langLabel = (code: string) => languageDisplayName(code, language) || fallbackLangLabel(code)

  if (editingLanguages) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push('/profile')}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
              aria-label={t('common.cancel')}
            >
              ←
            </button>
            <h1 className="text-xl font-bold text-gray-900">{t('profile.languageSettingsTitle')}</h1>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">{t('profile.nativeLanguage')}</p>
              <LanguagePicker
                value={nativeLang}
                onLanguageChange={setNativeLang}
                showVariantPicker={false}
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">{t('profile.fluentLanguages')}</p>
              <LanguagePicker
                multiSelect
                value={fluentLangs}
                onLanguageChange={setFluentLangs}
                excludeCodes={[nativeLang]}
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">{t('profile.learningLanguages')}</p>
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
              {updateLangMutation.isPending ? t('common.saving') : t('profile.saveChanges')}
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
              onClick={() => router.push('/profile')}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
              aria-label="back"
            >
              ←
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4">
              <label htmlFor="ui-language" className="block text-sm font-semibold text-gray-900">
                {t('settings.uiLanguage')}
              </label>
              <p className="text-xs text-gray-400 mt-0.5">{t('settings.uiLanguageSubtitle')}</p>
              <select
                id="ui-language"
                value={uiLang}
                onChange={(event) => updateUiLanguageMutation.mutate(event.target.value)}
                disabled={!me || updateUiLanguageMutation.isPending}
                className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
              >
                {UI_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {languageDisplayName(lang.code, language)}
                  </option>
                ))}
              </select>
              {langError && <p className="mt-2 text-xs text-red-500">{langError}</p>}
            </div>
            <div className="h-px bg-gray-100" />
            <button
              onClick={async () => {
                await logoutSession()
                queryClient.clear()
                router.replace('/login')
              }}
              className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span>
                <span className="block text-sm font-semibold text-gray-900">{t('settings.logout')}</span>
                <span className="block text-xs text-gray-400 mt-0.5">{t('settings.logoutSubtitle')}</span>
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
                  {deleteAccountMutation.isPending ? t('common.saving') : t('settings.deleteAccount')}
                </span>
                <span className="block text-xs text-gray-400 mt-0.5">{t('settings.deleteAccountSubtitle')}</span>
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
            aria-label="back"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{t('profile.title')}</h1>
          <button
            onClick={() => {
              setUiLang(me?.uiLanguage ?? language)
              setLangError(null)
              router.push('/profile/settings')
            }}
            className="ml-auto p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
            aria-label={t('settings.title')}
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
                      <label htmlFor="nickname-input" className="sr-only">{t('profile.nickname')}</label>
                      <div className="flex gap-2">
                        <input
                          id="nickname-input"
                          type="text"
                          value={nicknameInput}
                          onChange={(e) => setNicknameInput(e.target.value)}
                          maxLength={20}
                          placeholder={t('profile.nicknamePlaceholder')}
                          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400"
                          onKeyDown={(e) => e.key === 'Enter' && handleNicknameSave()}
                          autoFocus
                        />
                        <button
                          onClick={handleNicknameSave}
                          disabled={updateNicknameMutation.isPending}
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 transition-colors"
                        >
                          {updateNicknameMutation.isPending ? t('common.saving') : t('common.save')}
                        </button>
                        <button
                          onClick={() => setEditingNickname(false)}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          {t('common.cancel')}
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
                        aria-label={t('profile.nicknameEdit')}
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
                      {formatMessage(t('profile.nativeSpeaker'), { language: langLabel(profile.nativeLanguage) })}
                    </p>
                  )}
                </div>
                {levelMeta && !editingNickname && (
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${levelMeta.bg} ${levelMeta.color} ml-2 flex-shrink-0`}>
                    {t(levelMeta.key)}
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
                onClick={() => router.push('/profile/language-edit')}
                className="w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {t('profile.editLanguages')}
              </button>
            </div>

            <button
              onClick={() => router.push('/profile/wallet')}
              className="bg-white rounded-2xl border border-gray-100 p-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span>
                <span className="block text-sm font-semibold text-gray-500 mb-1">{t('profile.wallet')}</span>
                <span className="block text-2xl font-black text-blue-600">{me?.credits ?? '—'}</span>
              </span>
              <span className="text-gray-300 text-2xl">›</span>
            </button>

            {/* 스트릭 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-500 mb-3">{t('profile.streakTitle')}</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-orange-500">{profile.correctionStreak}</span>
                <span className="text-base font-semibold text-gray-500 mb-1">{t('profile.streakDays')}</span>
                {profile.correctionStreak >= 7 && (
                  <span className="ml-auto text-2xl" title={t('profile.badge.streak7.label')}>🔥</span>
                )}
              </div>
              {profile.correctionStreak === 0 ? (
                <p className="text-xs text-gray-400 mt-2">{t('profile.streakStart')}</p>
              ) : profile.correctionStreak > 0 && profile.correctionStreak % 7 === 0 ? (
                <p className="text-xs text-orange-600 mt-2 font-medium">
                  🎉 {formatMessage(t('profile.streakBonus'), { count: profile.correctionStreak })}
                </p>
              ) : null}
            </div>

            {/* 신뢰도 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-500 mb-3">{t('profile.reputationTitle')}</p>
              <ReputationBar score={profile.reputationScore} />
              <p className="text-xs text-gray-400 mt-2">
                {t('profile.reputationHelp')}
              </p>
            </div>

            {/* 뱃지 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-500 mb-3">{t('profile.badgesTitle')}</p>
              {profile.badges.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-3xl mb-2">🏅</p>
                  <p className="text-sm">{t('profile.noBadges')}</p>
                  <p className="text-xs mt-1">{t('profile.noBadgesHelp')}</p>
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
                          <p className="text-sm font-semibold text-gray-800">{t(meta.labelKey)}</p>
                          <p className="text-xs text-gray-500">{t(meta.descKey)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {profile.badges.length < Object.keys(BADGE_META).length && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 mb-2">{t('profile.availableBadges')}</p>
                  <div className="flex flex-col gap-2">
                    {Object.entries(BADGE_META)
                      .filter(([key]) => !profile.badges.some((b) => b.badgeType === key))
                      .map(([key, meta]) => (
                        <div key={key} className="flex items-center gap-3 p-3 opacity-40 grayscale">
                          <span className="text-2xl">{meta.icon}</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{t(meta.labelKey)}</p>
                            <p className="text-xs text-gray-500">{t(meta.descKey)}</p>
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
