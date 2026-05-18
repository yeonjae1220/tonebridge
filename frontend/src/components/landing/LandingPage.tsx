import Link from 'next/link'

const STEPS = [
  {
    num: '01',
    title: '교정 요청',
    desc: '텍스트 또는 음성으로 교정받고 싶은 내용을 올립니다.',
  },
  {
    num: '02',
    title: '첨삭 기여',
    desc: '다른 사람의 언어를 교정해서 크레딧을 얻습니다.',
  },
  {
    num: '03',
    title: '교정 받기',
    desc: '번 크레딧으로 내 발음·문장 교정을 받습니다.',
  },
]

const EXAMPLES = [
  {
    lang: '영어',
    flag: '🇺🇸',
    before: 'I am very enjoy to working with this team.',
    after: 'I really enjoy working with this team.',
    note: "enjoy는 동명사를 취합니다. 'very'보다 'really'가 더 자연스럽습니다.",
  },
  {
    lang: '한국어',
    flag: '🇰🇷',
    before: '오늘 날씨가 정말 좋아요. 나는 공원에 갔어요.',
    after: '오늘 날씨가 정말 좋아서 공원에 갔어요.',
    note: "두 문장을 '-아/어서'로 연결하면 더 자연스럽습니다.",
  },
]

const LANGUAGES = [
  { flag: '🇰🇷', label: '한국어' },
  { flag: '🇯🇵', label: '일본어' },
  { flag: '🇨🇳', label: '중국어' },
  { flag: '🇺🇸', label: '영어' },
  { flag: '🇪🇸', label: '스페인어' },
  { flag: '🇫🇷', label: '프랑스어' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Navbar */}
      <nav aria-label="메인 네비게이션" className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-gray-900">
            Tone<span className="text-blue-500">Bridge</span>
          </span>
          <Link
            href="/login"
            className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors"
          >
            로그인 / 시작하기
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
            교정해주고,<br />교정받는다
          </h1>
          <p className="mt-5 text-lg text-gray-500 leading-relaxed">
            텍스트와 음성을 올리면 실제 원어민이 교정해줍니다.<br />
            나도 남의 언어를 교정하면 크레딧을 얻습니다.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="px-6 py-3.5 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
            >
              시작하기 — 30 크레딧 무료
            </Link>
            <Link
              href="/feed"
              className="px-6 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              피드 둘러보기 →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 text-center mb-12">
            어떻게 작동하나요?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div key={step.num} className="flex flex-col gap-3">
                <span className="text-sm font-bold text-blue-500 tracking-widest">{step.num}</span>
                <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Correction examples */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 text-center mb-12">
            실제 교정 예시
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {EXAMPLES.map((ex) => (
              <div
                key={ex.lang}
                className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col gap-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{ex.flag}</span>
                  <span className="text-sm font-semibold text-gray-700">{ex.lang} 교정</span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-start">
                    <span className="shrink-0 mt-0.5 text-xs font-bold text-red-400 w-8">원문</span>
                    <p className="text-sm text-gray-500 line-through leading-relaxed">{ex.before}</p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="shrink-0 mt-0.5 text-xs font-bold text-green-500 w-8">교정</span>
                    <p className="text-sm text-gray-900 font-medium leading-relaxed">{ex.after}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 leading-relaxed">{ex.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Languages */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-400 font-medium mb-5 tracking-wide uppercase">지원 언어</p>
          <div className="flex flex-wrap justify-center gap-3">
            {LANGUAGES.map((lang) => (
              <span
                key={lang.label}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-100 rounded-full text-sm text-gray-700 shadow-sm"
              >
                {lang.flag} {lang.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 bg-blue-50">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            지금 바로 시작하세요
          </h2>
          <p className="mt-3 text-gray-500">가입하면 30 크레딧을 드립니다. 신용카드 불필요.</p>
          <Link
            href="/login"
            className="mt-7 inline-block px-8 py-3.5 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
          >
            30 크레딧으로 무료 시작
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100">
        <p className="text-center text-xs text-gray-400">© 2026 ToneBridge. All rights reserved.</p>
      </footer>
    </div>
  )
}
