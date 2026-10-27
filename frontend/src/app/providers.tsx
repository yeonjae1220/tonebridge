'use client'

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { tryRestoreSession } from '@/lib/api'
import { I18nProvider } from '@/i18n/I18nProvider'
import type { UiLanguage } from '@/i18n/messages'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { ErrorToast } from '@/components/ui/ErrorToast'
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/apiError'
import { useErrorToastStore } from '@/stores/errorToastStore'

/**
 * 뮤테이션 실패의 전역 안전망. 화면이 onError 를 직접 달았으면 그쪽이 책임지고, 안 달았으면 여기서
 * 로그 + 안내를 띄운다. 예전엔 뮤테이션 32개 중 21개가 onError 도 isError 도 없어 실패가 버튼
 * 무반응으로만 보였다(GLOBAL-PIT-108). 401 은 api 인터셉터가 세션 정리·로그인 이동을 맡는다.
 */
function createMutationCache() {
  return new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error('[mutation] 요청 실패', mutation.options.mutationKey ?? '', error)
      if (mutation.options.onError) return
      if (getApiErrorStatus(error) === 401) return
      useErrorToastStore.getState().show(getApiErrorMessage(error, '') || null)
    },
  })
}

export function Providers({
  children,
  initialLanguage,
}: {
  children: React.ReactNode
  initialLanguage?: UiLanguage
}) {
  const [queryClient] = useState(
    () => new QueryClient({
      mutationCache: createMutationCache(),
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
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {sessionReady ? (
          <I18nProvider initialLanguage={initialLanguage}>
            {children}
            <ErrorToast />
          </I18nProvider>
        ) : null}
      </QueryClientProvider>
    </ThemeProvider>
  )
}
