import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/request', '/correct', '/wallet', '/profile', '/admin', '/onboarding']

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self'",
    "connect-src 'self' https://tonebridge.mungji.com wss://tonebridge.mungji.com",
    "frame-src 'none'",
    "object-src 'none'",
  ].join('; ')

  // 인증 필요 경로 체크
  const { pathname } = request.nextUrl
  const needsAuth = PROTECTED.some((p) => pathname.startsWith(p))

  if (needsAuth && !request.cookies.has('session')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    const redirectRes = NextResponse.redirect(url)
    redirectRes.headers.set('Content-Security-Policy', csp)
    return redirectRes
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)',
  ],
}
