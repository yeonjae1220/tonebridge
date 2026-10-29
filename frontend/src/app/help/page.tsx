'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'

export default function HelpPage() {
  const { language } = useI18n()
  const ko = language === 'ko'
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending || !message.trim()) return
    setSending(true)
    setResult(null)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), email: email.trim(), version: 'mvp-pilot', website: '' }),
      })
      if (!response.ok) throw new Error('Could not send')
      setResult('success')
      setMessage('')
    } catch {
      setResult('error')
    } finally { setSending(false) }
  }
  return (
    <main className="mx-auto max-w-lg px-4 py-6 pb-24 space-y-6">
      <Link href="/study" className="text-blue-600">{ko ? '← 연습장으로' : '← Back to practice'}</Link>
      <h1 className="text-2xl font-bold">{ko ? '이용 안내와 문의' : 'Help and contact'}</h1>
      <section className="space-y-3 text-sm">
        <p>{ko ? '개인 연습과 친구의 공유 연습장은 커뮤니티에 자동 공개되지 않습니다.' : 'Personal and shared notebooks are never automatically posted to the community.'}</p>
        <p>{ko ? '친구 목록에서 삭제해도 기존 공유 연습장은 두 사람에게 남습니다. 접근 중단이나 기록 삭제가 필요하면 아래로 요청해 주세요. 본인과 대상 기록을 확인한 뒤 처리합니다.' : 'Removing a friend leaves existing shared notebooks accessible to both of you. Request access withdrawal or record deletion below. We verify your identity and the affected records before acting.'}</p>
        <p>{ko ? '카드와 연습장의 삭제는 작성자 메뉴에서 할 수 있습니다. 화면에서 삭제된 기록과 저장소 원본의 즉시 영구 삭제는 다를 수 있습니다. 원본 삭제가 필요하면 문의해 주세요.' : 'Creators can delete cards and notebooks from their menus. Removal from the screen may not immediately erase stored audio. Contact us if you need source files erased.'}</p>
        <p>{ko ? '초기 검증에서는 참여·재시도 시점과 녹음·업로드의 성공 및 실패를 확인합니다. 분석 기록에 학습 문장이나 녹음 내용을 복사하지 않으며, 검증용 활동 기록은 최대 31일 보관한 뒤 정리합니다.' : 'During the pilot we measure participation, retries, and recording/upload outcomes. Analytics do not copy your learning text or recordings. Pilot activity records are retained in the live database for up to 31 days.'}</p>
        <p>{ko ? '저장 전 새로고침하거나 화면을 닫으면 초안이 사라질 수 있습니다. 전송에 실패했다면 같은 화면에서 다시 시도해 주세요.' : 'Unsaved drafts may be lost if you refresh or close the page. If sending fails, retry from the same screen.'}</p>
      </section>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">{ko ? '답변받을 이메일 (선택)' : 'Reply email (optional)'}
          <input type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} disabled={sending} className="mt-1 w-full rounded border p-2 bg-surface" />
        </label>
        <label className="block text-sm">{ko ? '문의 내용' : 'Message'}
          <textarea required maxLength={2000} rows={5} value={message} disabled={sending} onChange={(e) => setMessage(e.target.value)} className="mt-1 w-full rounded border p-2 bg-surface" />
        </label>
        <p className="text-xs text-gray-500">{ko ? '문제가 생긴 화면과 원하는 조치를 적어 주세요. 비밀번호·토큰·녹음 원본은 보내지 마세요. 답변이 필요하면 이메일을 남기거나 검증 진행자에게 직접 연락해 주세요.' : 'Describe the screen and the action you need. Do not include passwords, tokens, or recordings. Leave an email for a reply, or contact your pilot facilitator directly.'}</p>
        <button disabled={sending || !message.trim()} className="rounded-xl bg-blue-600 text-white px-4 py-2 disabled:opacity-40">{sending ? (ko ? '보내는 중…' : 'Sending…') : (ko ? '문의 보내기' : 'Send message')}</button>
        {result && <p role={result === 'error' ? 'alert' : 'status'}>{result === 'success'
          ? (ko ? '문의를 보냈습니다. 삭제나 접근 중단은 확인 후 처리됩니다.' : 'Message sent. Deletion or access changes require verification.')
          : (ko ? '보내지 못했습니다. 내용은 유지됩니다. 다시 시도하거나 검증 진행자에게 연락해 주세요.' : 'Could not send. Your message is kept. Retry or contact your pilot facilitator.')}</p>}
      </form>
    </main>
  )
}
