/** @type {import('next').NextConfig} */
// CSP는 middleware.ts에서 nonce 기반으로 생성 — 여기선 정적 보안 헤더만 관리
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // 빈 allowlist `()` 는 자기 출처까지 막는다 — 녹음(getUserMedia)을 쓰므로 microphone 만 self 로 연다.
  // mobile/nginx.conf 와 같은 값을 유지할 것 (GLOBAL-PIT-190)
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
]

const nextConfig = {
  output: 'standalone',
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:8080'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
