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
        <p>{ko ? '연습장 나가기는 내 접근만 종료합니다. 친구 삭제 시 ‘기존 공유 연습장 접근도 종료’를 선택하면 현재 두 사람이 함께 참여 중인 연습장의 양쪽 접근을 종료합니다. 선택하지 않으면 기존 접근은 유지됩니다. 원본은 삭제되지 않으며, 이미 발급된 음성 링크는 최대 15분 유효할 수 있습니다. 원본 영구 삭제나 접근 복구는 아래로 문의해 주세요.' : 'Leaving a notebook ends only your access. When removing a friend, selecting the shared-access option ends access for both of you to notebooks you currently share. Without it, existing access remains. Source files are retained and issued audio links may remain valid for up to 15 minutes. Contact us for permanent deletion or access restoration.'}</p>
        <p>{ko ? '카드와 연습장의 삭제는 작성자 메뉴에서 할 수 있습니다. 화면에서 삭제된 기록과 저장소 원본의 즉시 영구 삭제는 다를 수 있습니다. 원본 삭제가 필요하면 문의해 주세요.' : 'Creators can delete cards and notebooks from their menus. Removal from the screen may not immediately erase stored audio. Contact us if you need source files erased.'}</p>
        <p>{ko ? '안내를 받고 참여 등록한 기간에만 검증용 활동과 녹음·업로드 진단을 수집합니다. 공유 활동은 관련된 사람 모두 참여 중일 때 기록하며, 진단은 사용자 식별자가 없는 일별 합계로 보관합니다. 분석 기록에 학습 문장이나 녹음 내용을 복사하지 않습니다. 활동·진단은 서버가 정상 운영되는 동안 최대 31일 이내 정리하며, 학습 원본·문의·로그·백업의 보관은 별도입니다. 참여 중단은 아래로 요청할 수 있고, 참여하지 않아도 학습 기능을 이용할 수 있습니다.' : 'Pilot activity and recording/upload diagnostics are collected only during your registered participation period after receiving the notice. Shared activity requires all involved participants to be enrolled. Diagnostics are daily totals without user identifiers. Analytics do not copy your learning text or recordings. Activity and diagnostic records are cleared within 31 days while the service is operating normally; learning content, support requests, logs and backups have separate retention rules. Contact us below to withdraw. Learning remains available without pilot participation.'}</p>
        <p>{ko ? '임시 보관 완료된 작성 내용과 녹음은 같은 계정·브라우저에서 마지막 보관 후 7일까지 복구할 수 있습니다. 연습장의 ‘초안 관리’에서 이어쓰기와 다운로드가 가능합니다. 로그아웃·계정 변경 시 해당 초안은 정리됩니다. 브라우저 데이터 삭제, 저장소 회수, 보관 실패 시에는 복구를 보장하지 않으므로 필요한 내용은 내려받아 주세요. 기기 간 동기화는 지원하지 않습니다.' : 'Locally backed-up content and recordings can be recovered in the same account and browser for seven days after the last backup. Open Drafts from practice to continue or download them. Logout or account switching clears the drafts. Browser data deletion, storage eviction or failed backups can prevent recovery; download anything you need. Drafts do not sync between devices.'}</p>
      </section>
      <section id="account-access" className="scroll-mt-4 space-y-3 rounded-xl border border-gray-200 p-4 text-sm">
        <h2 className="font-semibold">{ko ? '계정 접속 도움말' : 'Account access help'}</h2>
        <p>{ko ? 'Google로 가입했다면 로그인 화면에서 ‘Google로 시작하기’를 선택하세요. 이메일 계정의 자동 비밀번호 재설정은 아직 지원하지 않습니다.' : 'If you signed up with Google, choose Continue with Google on the login screen. Automated email-password reset is not available yet.'}</p>
        <p>{ko ? '접속 문제는 아래로 문의할 수 있습니다. 문의만으로 비밀번호나 계정 권한이 바뀌지 않으며, 본인 확인과 가능한 조치를 안내합니다. 비밀번호·인증 코드는 보내지 마세요.' : 'Contact us below for access issues. A message alone does not change passwords or access; identity verification and available options must be checked. Never send passwords or verification codes.'}</p>
        <Link href="/login" className="inline-block py-2 text-blue-600">{ko ? '로그인으로 돌아가기' : 'Back to login'}</Link>
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
