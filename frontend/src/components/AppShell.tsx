'use client'

import { usePathname } from 'next/navigation'
import { BottomNav } from '@/components/ui/BottomNav'

const NAV_PATHS = ['/', '/feed', '/wallet', '/profile']

function shouldShowNav(pathname: string) {
  return NAV_PATHS.some((p) => (p === '/' ? pathname === '/' : pathname === p))
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showNav = shouldShowNav(pathname)

  return (
    <>
      <div className={showNav ? 'pb-16' : ''}>{children}</div>
      {showNav && <BottomNav />}
    </>
  )
}
