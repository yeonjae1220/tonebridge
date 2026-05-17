'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { tryRestoreSession } from '@/lib/api'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60 * 1000, retry: 1 },
      },
    })
  )

  // sessionReady가 false인 동안 children을 렌더하지 않아
  // React Query의 useQuery가 tryRestoreSession보다 먼저 실행되어
  // 중복 /auth/refresh 호출이 발생하는 레이스 컨디션을 방지합니다.
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    tryRestoreSession().finally(() => setSessionReady(true))
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {sessionReady ? children : null}
    </QueryClientProvider>
  )
}
