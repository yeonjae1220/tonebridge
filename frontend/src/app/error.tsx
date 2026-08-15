'use client'

import { useEffect } from 'react'
import { useI18n } from '@/i18n/I18nProvider'

/**
 * 루트 세그먼트 에러 바운더리.
 *
 * Next.js 에는 내장 전역 바운더리가 있어 이 파일이 없어도 빈 화면이 되지는
 * 않는다. 다만 그 기본 화면은 앱 UI 전체를 영어 기술 문구로 갈아끼우고
 * 복구 수단이 새로고침뿐이다. 여기서는 루트 레이아웃을 살린 채 reset() 으로
 * 다시 시도할 수 있게 한다.
 *
 * 주의 1: 실패를 조용히 넘기면 안 된다. 화면이 복구돼도 원인은 콘솔에 남겨야
 * 운영에서 추적이 된다(GLOBAL-PIT-020 계열).
 * 주의 2: 색은 이 앱의 토큰 형식에 맞춰 적었다. 토큰이 "15 23 42" 같은 RGB
 * 트리플인 앱에서 var() 를 그대로 쓰면 CSS 가 무효가 되는데, var() 의 폴백은
 * "변수 없음"에만 걸리고 "값이 잘못됨"에는 안 걸려 조용히 색이 사라진다.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    console.error('[error boundary]', error)
  }, [error])

  return (
    <div
      role="alert"
      style={{
        display: 'grid',
        justifyItems: 'center',
        alignContent: 'center',
        gap: 16,
        minHeight: '60vh',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: 15, color: 'rgb(var(--color-text-primary, 15 23 42))' }}>{t('error.unexpected')}</p>

      {/* digest 는 서버 로그와 이 화면을 잇는 유일한 상관관계 키다. */}
      {error.digest && <code style={{ fontSize: 11, color: 'rgb(var(--color-text-secondary, 100 116 139))' }}>{error.digest}</code>}

      <button
        onClick={reset}
        style={{
          minHeight: 40,
          padding: '0 16px',
          fontSize: 13,
          cursor: 'pointer',
          background: 'none',
          color: 'rgb(var(--color-text-primary, 15 23 42))',
          border: '1px solid rgb(var(--color-border-subtle, 226 232 240))',
          borderRadius: '8px',
        }}
      >
        {t('common.retry')}
      </button>
    </div>
  )
}
