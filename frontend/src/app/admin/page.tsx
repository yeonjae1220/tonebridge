'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { isAdminToken } from '@/lib/jwtUtils'
import type { AdminStats } from '@/types'
import type { AxiosError } from 'axios'

const LANG_LABELS: Record<string, string> = {
  ko: '한국어', ja: '일본어', zh: '중국어', en: '영어', es: '스페인어', fr: '프랑스어',
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-xs font-semibold text-gray-400 mb-1">{label}</p>
      <p className="text-3xl font-black text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()

  const isAdmin = accessToken ? isAdminToken(accessToken) : false

  useEffect(() => {
    if (!accessToken) router.replace('/login')
    else if (!isAdmin) router.replace('/feed')
  }, [accessToken, isAdmin, router])

  const { data: stats, isLoading, isError, error } = useQuery<AdminStats, AxiosError>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    enabled: !!accessToken && isAdmin,
    retry: false,
  })

  useEffect(() => {
    if (!isError) return
    const status = (error as AxiosError)?.response?.status
    router.replace(status === 403 ? '/feed' : '/feed')
  }, [isError, error, router])

  if (!accessToken || !isAdmin) return null

  const passRatePct = stats ? Math.round(stats.qualityPassRate * 100) : 0

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
              aria-label="뒤로가기"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
              <p className="text-xs text-gray-400 mt-0.5">Admin only</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/admin/users')}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors"
          >
            사용자 관리
          </button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {stats && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="전체 요청" value={stats.totalRequests.toLocaleString()} />
              <StatCard label="대기 중" value={stats.pendingRequests.toLocaleString()} />
              <StatCard label="완료됨" value={stats.completedRequests.toLocaleString()} />
              <StatCard
                label="AI 품질 통과율"
                value={`${passRatePct}%`}
                sub="승인 / (승인 + 반려)"
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-500 mb-3">언어별 대기 요청</p>
              {Object.keys(stats.pendingByLanguage).length === 0 ? (
                <p className="text-sm text-gray-400">대기 중인 요청이 없습니다.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {Object.entries(stats.pendingByLanguage)
                    .sort(([, a], [, b]) => b - a)
                    .map(([lang, count]) => {
                      const max = Math.max(...Object.values(stats.pendingByLanguage))
                      const pct = max > 0 ? (count / max) * 100 : 0
                      const isHot = count >= 5
                      return (
                        <div key={lang} className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-700 w-16 shrink-0">
                            {LANG_LABELS[lang] ?? lang}
                          </span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isHot ? 'bg-red-400' : 'bg-blue-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold w-8 text-right ${isHot ? 'text-red-600' : 'text-gray-700'}`}>
                            {count}
                          </span>
                          {isHot && <span className="text-xs text-red-500 font-semibold">과부하</span>}
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
