'use client'

import { useState } from 'react'
import { usePWAInstall } from '@/hooks/usePWAInstall'

// 앱스토어 출시 후 여기에 URL을 채워 넣으세요
const APP_STORE_URL = '' // iOS App Store URL
const PLAY_STORE_URL = '' // Android Play Store URL

interface Props {
  className?: string
}

export function InstallBanner({ className = '' }: Props) {
  const { installPrompt, isInstalled, platform, triggerInstall } = usePWAInstall()
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (isInstalled || dismissed) return null

  const hasNativeApp = platform === 'ios' ? !!APP_STORE_URL : !!PLAY_STORE_URL
  const showPWAButton = platform === 'android' ? !!installPrompt : platform === 'ios'
  const showAnyButton = showPWAButton || hasNativeApp

  if (!showAnyButton) return null

  return (
    <>
      <div className={`flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl ${className}`}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">ToneBridge 앱으로 더 편리하게</p>
          <p className="text-xs text-gray-500 mt-0.5">홈 화면에 추가해서 앱처럼 사용하세요</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showPWAButton && (
            <button
              onClick={platform === 'ios' ? () => setShowIOSGuide(true) : triggerInstall}
              className="px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors"
            >
              {platform === 'ios' ? '추가 방법' : '홈 화면에 추가'}
            </button>
          )}

          {platform === 'android' && PLAY_STORE_URL && (
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-xs font-semibold text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <GooglePlayIcon />
              Play Store
            </a>
          )}

          {platform === 'ios' && APP_STORE_URL && (
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-xs font-semibold text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <AppleIcon />
              App Store
            </a>
          )}

          <button
            onClick={() => setDismissed(true)}
            aria-label="닫기"
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-6 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">홈 화면에 추가</h2>
              <button
                onClick={() => setShowIOSGuide(false)}
                aria-label="닫기"
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <ol className="flex flex-col gap-4">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Safari 하단 공유 버튼 탭</p>
                  <p className="text-xs text-gray-500 mt-0.5">화면 아래 가운데에 있는 □↑ 아이콘</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">스크롤 내려서 &ldquo;홈 화면에 추가&rdquo; 탭</p>
                  <p className="text-xs text-gray-500 mt-0.5">목록에서 + 아이콘과 함께 표시돼요</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">오른쪽 위 &ldquo;추가&rdquo; 탭</p>
                  <p className="text-xs text-gray-500 mt-0.5">홈 화면에 ToneBridge 아이콘이 생겨요</p>
                </div>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function GooglePlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M3 20.5v-17c0-.83 1-.97 1.45-.5l11 8.5-11 8.5C3.99 21.47 3 21.33 3 20.5z" fill="#4CAF50"/>
      <path d="M16.45 11.5L4.46 3.5 14 12l2.45-.5z" fill="#03A9F4"/>
      <path d="M16.45 12.5L14 12l2.45.5 3.1 2.4c.59.46.59 1.18 0 1.64l-3.1 2.4-2.45.5 9.99-8.5z" fill="#F44336"/>
      <path d="M4.46 20.5L14 12l2.45.5-12 8.5z" fill="#FFC107"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}
