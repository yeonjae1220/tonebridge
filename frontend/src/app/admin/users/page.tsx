'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { isAdminToken } from '@/lib/jwtUtils'
import type { AdminUserSummary, PageResponse } from '@/types'
import type { AxiosError } from 'axios'

const LANG_LABELS: Record<string, string> = {
  ko: '한국어', ja: '일본어', zh: '중국어', en: '영어', es: '스페인어', fr: '프랑스어',
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [deltaInput, setDeltaInput] = useState('')

  const isAdmin = accessToken ? isAdminToken(accessToken) : false

  useEffect(() => {
    if (!accessToken) router.replace('/login')
    else if (!isAdmin) router.replace('/feed')
  }, [accessToken, isAdmin, router])

  const { data, isLoading, isError, error } = useQuery<PageResponse<AdminUserSummary>, AxiosError>({
    queryKey: ['admin', 'users', page],
    queryFn: () => api.get(`/admin/users?page=${page}&size=20`).then((r) => r.data),
    enabled: !!accessToken && isAdmin,
    retry: false,
  })

  useEffect(() => {
    if (!isError) return
    const status = (error as AxiosError)?.response?.status
    router.replace(status === 403 ? '/feed' : '/feed')
  }, [isError, error, router])

  const adjustMutation = useMutation({
    mutationFn: ({ userId, delta }: { userId: string; delta: number }) =>
      api.patch(`/admin/users/${userId}/credits?delta=${delta}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setAdjustingId(null)
      setDeltaInput('')
    },
  })

  if (!accessToken) return null

  const users = data?.content ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/admin')}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="뒤로가기"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && users.length === 0 && (
          <p className="text-center text-gray-400 py-16">사용자가 없습니다.</p>
        )}

        <div className="flex flex-col gap-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-2xl border border-gray-100 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 truncate">{user.username}</span>
                    {user.isAdmin && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                        관리자
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs text-gray-600">
                      {LANG_LABELS[user.nativeLanguage] ?? user.nativeLanguage} 원어민
                    </span>
                    <span className="text-xs text-blue-600 font-semibold">
                      {user.credits}크레딧
                    </span>
                    <span className="text-xs text-orange-600">
                      스트릭 {user.correctionStreak}일
                    </span>
                    <span className="text-xs text-gray-500">
                      평판 {user.reputationScore.toFixed(1)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setAdjustingId(adjustingId === user.id ? null : user.id)
                    setDeltaInput('')
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors shrink-0"
                >
                  크레딧 조정
                </button>
              </div>

              {adjustingId === user.id && (
                <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-100">
                  <input
                    type="number"
                    value={deltaInput}
                    onChange={(e) => setDeltaInput(e.target.value)}
                    placeholder="예: 10 또는 -5"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button
                    onClick={() => {
                      const delta = parseInt(deltaInput, 10)
                      if (isNaN(delta) || delta === 0) return
                      adjustMutation.mutate({ userId: user.id, delta })
                    }}
                    disabled={adjustMutation.isPending}
                    className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    적용
                  </button>
                  <button
                    onClick={() => { setAdjustingId(null); setDeltaInput('') }}
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              이전
            </button>
            <span className="text-sm text-gray-500">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
