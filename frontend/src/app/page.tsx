'use client'

import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export default function HomePage() {
  const router = useRouter()
  const { data: user } = useCurrentUser()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900">
            Tone<span className="text-blue-500">Bridge</span>
          </h1>
          <p className="text-lg text-gray-500 mt-3">
            남의 언어를 교정해주면 → 크레딧 획득 → 내 발음/문장도 교정받는다
          </p>
        </div>

        {user ? (
          <div className="flex flex-col gap-3 max-w-sm mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm text-gray-500">내 크레딧</p>
                <p className="text-2xl font-bold text-blue-600">{user.credits}</p>
              </div>
              <button
                onClick={() => router.push('/wallet')}
                className="text-sm text-blue-500 hover:underline"
              >
                내역 →
              </button>
            </div>
            <button
              onClick={() => router.push('/request')}
              className="w-full py-3.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors"
            >
              교정 요청하기
            </button>
            <button
              onClick={() => router.push('/feed')}
              className="w-full py-3.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              첨삭해서 크레딧 벌기
            </button>
            <button
              onClick={() => router.push('/feed?tab=mine')}
              className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              내 요청 보기
            </button>
          </div>
        ) : (
          <div className="flex gap-4 justify-center pt-4">
            <a
              href="/login"
              className="px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors"
            >
              로그인 / 시작하기
            </a>
            <a
              href="/feed"
              className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              첨삭 피드 보기
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
