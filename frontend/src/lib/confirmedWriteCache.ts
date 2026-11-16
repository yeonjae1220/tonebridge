import type { QueryClient, QueryKey } from '@tanstack/react-query'

/** Apply a confirmed write without waiting for reads; old in-flight reads must not revert it. */
export function updateConfirmedQuery<T>(client: QueryClient, queryKey: QueryKey, update: (current: T | undefined) => T | undefined) {
  // Cancellation/revert is synchronous; its returned promise is only completion bookkeeping.
  void client.cancelQueries({ queryKey, exact: true })
  client.setQueryData<T>(queryKey, update)
}
