import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { withRequestDeadline } from '@/lib/requestDeadline'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: ({ signal }) => withRequestDeadline(signal => api.get<User>('/users/me', { signal }).then(r => r.data), 15_000, signal),
    enabled: !!accessToken,
    staleTime: 60_000,
  })
}
