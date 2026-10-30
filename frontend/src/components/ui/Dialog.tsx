'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '@/i18n/I18nProvider'

/** Native top-layer dialog keeps navigation behind the sheet and traps keyboard focus. */
export function Dialog({ title, onClose, busy = false, children }: {
  title: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const { t } = useI18n()
  useEffect(() => {
    const dialog = ref.current!
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])
  return (
    <dialog ref={ref} aria-label={title}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-gray-200 bg-surface p-5 text-gray-900 shadow-xl backdrop:bg-black/60">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label={t('common.close')}
          className="h-11 w-11 shrink-0 rounded-xl text-gray-600 hover:bg-gray-100 disabled:opacity-40">×</button>
      </div>
      {children}
    </dialog>
  )
}
