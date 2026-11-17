import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { withRequestDeadline } from '@/lib/requestDeadline'
import { useAuthStore } from '@/stores/authStore'

// This identity is always fetched in the current session; a previous ['me'] cache
// entry must never select a private queue for a newly authenticated account.
export function useCloudOwner() {
  const { accessToken, sessionGeneration } = useAuthStore()
  return useQuery<{ id: string }>({ queryKey: ['cloud-owner', sessionGeneration], enabled: !!accessToken,
    queryFn: ({ signal }) => withRequestDeadline(s => api.get('/users/me', { signal: s }).then(r => r.data), 15000, signal), retry: false })
}
