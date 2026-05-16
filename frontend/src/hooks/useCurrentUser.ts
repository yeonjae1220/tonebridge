import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    enabled: !!accessToken,
    staleTime: 60_000,
  })
}
