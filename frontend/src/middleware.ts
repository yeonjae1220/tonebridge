import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// matcher에 등록된 경로만 이 함수에 진입하므로 별도 경로 체크 불필요
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('session')
  if (hasSession) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('redirect', request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/request/:path*',
    '/correct/:path*',
    '/wallet/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
  ],
}
