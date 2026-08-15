'use client'

import { useEffect } from 'react'

/**
 * 루트 레이아웃 자체가 던졌을 때만 렌더된다.
 *
 * 이 단계에서는 Provider 도 앱 CSS 도 없다고 가정해야 한다 — 그래서 번역 대신
 * 영어 고정 문구를 쓰고(앱들의 FALLBACK_LANG 과 동일), <html>/<body> 를 직접
 * 렌더한다. 앱의 테마 토큰도 없으므로 색은 OS 설정(prefers-color-scheme)을
 * 따른다. 색을 한쪽으로 고정하면 밝은 테마 앱에서 검은 화면이 튀어나온다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error boundary]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <style>{`
          .ge-root {
            color-scheme: light dark;
            --ge-bg: #fafafa; --ge-fg: #1a1a1a; --ge-dim: #6b6b6b; --ge-line: #d4d4d4;
          }
          @media (prefers-color-scheme: dark) {
            .ge-root {
              --ge-bg: #111; --ge-fg: #ededed; --ge-dim: #8a8a8a; --ge-line: #3a3a3a;
            }
          }
        `}</style>
        <div
          className="ge-root"
          role="alert"
          style={{
            display: 'grid',
            justifyItems: 'center',
            alignContent: 'center',
            gap: 16,
            minHeight: '100vh',
            padding: 24,
            textAlign: 'center',
            background: 'var(--ge-bg)',
            color: 'var(--ge-fg)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p style={{ fontSize: 15 }}>Something went wrong.</p>
          {error.digest && <code style={{ fontSize: 11, color: 'var(--ge-dim)' }}>{error.digest}</code>}
          <button
            onClick={reset}
            style={{
              minHeight: 40,
              padding: '0 16px',
              fontSize: 13,
              cursor: 'pointer',
              background: 'none',
              color: 'inherit',
              border: '1px solid var(--ge-line)',
              borderRadius: 8,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
