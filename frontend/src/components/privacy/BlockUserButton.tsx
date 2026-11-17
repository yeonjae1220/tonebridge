'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { withWriteDeadline, WriteOutcomeUnknownError } from '@/lib/writeDeadline'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n/I18nProvider'
import { Dialog } from '@/components/ui/Dialog'

export function BlockUserButton({ userId, username }: { userId?: string | null; username?: string | null }) {
  const generation = useAuthStore(s => s.sessionGeneration)
  return <BlockAction key={`${generation}:${userId}`} userId={userId} username={username} />
}
function BlockAction({ userId, username }: { userId?: string | null; username?: string | null }) {
  const { data: me } = useCurrentUser()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const mounted = useRef(true)
  const generation = useAuthStore(s => s.sessionGeneration)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const mutation = useMutation({
    mutationFn: () => withWriteDeadline(signal => api.put(`/users/me/blocks/${userId}`, undefined, { signal })),
    onSuccess: () => {
      // Reload clears all previous peer snapshots. Never navigate a later account/screen.
      if (mounted.current && generation === useAuthStore.getState().sessionGeneration) window.location.assign('/friends')
    },
    onError: () => {},
  })
  if (!userId || !me || userId === me.id) return null
  return <div onClick={event => event.stopPropagation()}>
    <button type="button" onClick={() => { mutation.reset(); setOpen(true) }} className="min-h-11 px-2 text-sm text-red-700">{t('blocks.block')}</button>
    {open && <Dialog title={t('blocks.block') + (username ? ' · ' + username : '')} busy={mutation.isPending} onClose={() => setOpen(false)}>
      <p className="mb-4 text-sm">{t('blocks.help')}</p>
      {mutation.isError && <div role="alert" className="my-3 text-sm text-red-700">
        <p>{t(mutation.error instanceof WriteOutcomeUnknownError ? 'common.actionUncertain' : 'error.unexpected')}</p>
        <a href="/profile/blocked" className="underline">{t('blocks.title')}</a>
      </div>}
      <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()} className="min-h-11 rounded-xl bg-red-700 px-4 text-white disabled:opacity-40">{t(mutation.isPending ? 'common.saving' : 'blocks.block')}</button>
    </Dialog>}
  </div>
}
