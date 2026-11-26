'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { withWriteDeadline, WriteOutcomeUnknownError } from '@/lib/writeDeadline'

export default function HelpPage() {
  const { language } = useI18n()
  const ko = language === 'ko'
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | 'unknown' | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending || !message.trim()) return
    setSending(true)
    setResult(null)
    try {
      const response = await withWriteDeadline(signal => fetch('/api/feedback', {
        signal,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), email: email.trim(), version: 'mvp-pilot', website: '' }),
      }))
      // The relay can lose the downstream response after the message was accepted.
      if (response.status >= 500) throw new WriteOutcomeUnknownError()
      if (!response.ok) throw new Error('Could not send')
      setResult('success')
      setMessage('')
    } catch (error) {
      setResult(error instanceof WriteOutcomeUnknownError || error instanceof TypeError ? 'unknown' : 'error')
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
      </section>
      <section className="space-y-3 text-sm" aria-labelledby="draft-help">
        <h2 id="draft-help" className="font-semibold">{ko ? '초안 복구와 동기화' : 'Draft recovery and sync'}</h2>
        <p>{ko ? '이 브라우저에서 임시 보관이 완료된 글과 녹음은 같은 계정으로 마지막 보관 후 7일까지 복구할 수 있습니다. 로그아웃하거나 계정을 바꾸면 이 브라우저의 초안이 지워집니다. 보관하지 못했거나 브라우저 데이터가 삭제될 수 있다면 필요한 초안을 내려받아 두세요.' : 'When local backup succeeds, you can recover text and recordings in this browser with the same account for seven days after the last backup. Signing out or switching accounts clears drafts from this browser. Download any draft you need if backup fails or browser data might be cleared.'}</p>
        <p>{ko ? '웹의 초안 동기화는 기본으로 꺼져 있습니다. 켜면 같은 계정으로 다른 기기의 웹에서도 서버에 보관한 텍스트 초안을 열 수 있습니다. 녹음은 별도 동의를 한 뒤 완료된 녹음을 선택해 올릴 수 있습니다.' : 'Web draft sync is off by default. Turn it on to open synced text drafts on the web from another device signed in to the same account. Recordings require separate consent and can be uploaded after recording is complete.'}</p>
        <p>{ko ? '로그아웃하거나 동기화를 중단해도 서버 사본은 보관 기간 동안 남습니다. 서버 사본을 지우려면 설정에서 ‘서버 초안 삭제·동기화 중단’을 선택하세요.' : 'Signing out or stopping sync keeps server copies until they expire. To remove those copies, choose “Erase cloud drafts and stop sync” in draft settings.'}</p>
        <Link href="/drafts" className="mr-4 inline-flex min-h-11 items-center text-blue-600 underline">{ko ? '초안 관리 열기' : 'Open Drafts'}</Link>
        <Link href="/drafts/cloud" className="inline-flex min-h-11 items-center text-blue-600 underline">{ko ? '초안 동기화 설정 열기' : 'Open draft sync settings'}</Link>
      </section>
      <section id="account-access" className="scroll-mt-4 space-y-3 rounded-xl border border-gray-200 p-4 text-sm">
        <h2 className="font-semibold">{ko ? '계정 접속 도움말' : 'Account access help'}</h2>
        <p>{ko ? 'Google로 가입했다면 로그인 화면에서 ‘Google로 시작하기’를 선택하세요. 이메일로 가입했다면 비밀번호 재설정 메일을 요청할 수 있습니다. 링크는 15분 동안 한 번만 사용할 수 있고, 변경 후 모든 기기에서 다시 로그인해야 합니다.' : 'If you signed up with Google, choose Continue with Google on the login screen. For email-password accounts, request a reset email. The link works once for 15 minutes; sign in again on every device after changing your password.'}</p>
        <Link href="/forgot-password" className="block text-blue-600">{ko ? '비밀번호 재설정 메일 요청' : 'Request a password reset email'}</Link>
        <p>{ko ? '접속 문제는 아래로 문의할 수 있습니다. 문의만으로 비밀번호나 계정 권한이 바뀌지 않으며, 본인 확인과 가능한 조치를 안내합니다. 비밀번호·인증 코드는 보내지 마세요.' : 'Contact us below for access issues. A message alone does not change passwords or access; identity verification and available options must be checked. Never send passwords or verification codes.'}</p>
        <Link href="/login" className="inline-block py-2 text-blue-600">{ko ? '로그인으로 돌아가기' : 'Back to login'}</Link>
      </section>
      <nav aria-label={ko ? '정책' : 'Policies'} className="flex gap-4 text-sm">
        <Link href="/terms" className="inline-flex min-h-11 items-center text-blue-600 underline">{ko ? '이용약관' : 'Terms of Service'}</Link>
        <Link href="/privacy" className="inline-flex min-h-11 items-center text-blue-600 underline">{ko ? '개인정보 처리방침' : 'Privacy Policy'}</Link>
      </nav>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">{ko ? '답변받을 이메일 (선택)' : 'Reply email (optional)'}
          <input type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} disabled={sending} className="mt-1 w-full rounded border p-2 bg-surface" />
        </label>
        <label className="block text-sm">{ko ? '문의 내용' : 'Message'}
          <textarea required maxLength={2000} rows={5} value={message} disabled={sending} onChange={(e) => setMessage(e.target.value)} className="mt-1 w-full rounded border p-2 bg-surface" />
        </label>
        <p className="text-xs text-gray-500">{ko ? '문제가 생긴 화면과 원하는 조치를 적어 주세요. 비밀번호·토큰·녹음 원본은 보내지 마세요. 답변이 필요하면 이메일을 남기거나 검증 진행자에게 직접 연락해 주세요.' : 'Describe the screen and the action you need. Do not include passwords, tokens, or recordings. Leave an email for a reply, or contact your pilot facilitator directly.'}</p>
        <button disabled={sending || !message.trim()} className="rounded-xl bg-blue-600 text-white px-4 py-2 disabled:opacity-40">{sending ? (ko ? '보내는 중…' : 'Sending…') : (ko ? '문의 보내기' : 'Send message')}</button>
        {result && <p role={result === 'success' ? 'status' : 'alert'}>{result === 'success'
          ? (ko ? '문의를 보냈습니다. 삭제나 접근 중단은 확인 후 처리됩니다.' : 'Message sent. Deletion or access changes require verification.')
          : result === 'unknown'
            ? (ko ? '접수 여부를 확인하지 못했습니다. 이미 접수되었을 수 있어 자동으로 다시 보내지 않습니다. 내용은 유지됩니다. 검증 진행자에게 확인하거나 필요한 경우 다시 보내 주세요.' : 'Receipt could not be confirmed. Your message may already have arrived, so it will not be sent again automatically. Your input is kept. Check with your pilot facilitator or send again if needed.')
          : (ko ? '보내지 못했습니다. 내용은 유지됩니다. 다시 시도하거나 검증 진행자에게 연락해 주세요.' : 'Could not send. Your message is kept. Retry or contact your pilot facilitator.')}</p>}
      </form>
    </main>
  )
}
