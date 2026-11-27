import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_MINIMUM_AGE,
  LEGAL_OPERATOR,
  type LegalDocumentContent,
  type LegalLanguage,
} from '@/lib/legal'

// Every statement here must match what the service does. When collection, retention,
// or an outside service changes, update this text and the store privacy forms
// (docs/release/app-store.md §3, docs/release/android-play.md §3) together.

const ko: LegalDocumentContent = {
  title: '개인정보 처리방침',
  intro: `${LEGAL_OPERATOR.ko}(이하 "운영자")는 ToneBridge 웹과 앱(이하 "서비스")을 이용하는 분의 개인정보를 「개인정보 보호법」에 따라 처리합니다. 서비스는 광고·분석·크래시 수집 도구를 쓰지 않으며, 개인정보를 판매하거나 다른 회사의 데이터와 결합하지 않습니다.`,
  sections: [
    {
      heading: '처리하는 개인정보',
      items: [
        '가입 시(필수): 이메일 주소, 닉네임, 모국어·학습 언어·화면 언어 설정. 이메일로 가입하면 비밀번호를 받되 복원할 수 없는 형태(BCrypt 해시)로만 저장합니다.',
        'Google로 로그인: Google이 확인해 준 이메일 주소만 저장합니다. 이름과 프로필 사진은 저장하지 않습니다.',
        'Apple로 로그인: Apple 사용자 식별자와 이메일 주소(이메일 가리기를 선택했다면 Apple의 중계 주소)를 저장합니다. 이름은 저장하지 않습니다.',
        '이용 중 직접 만드는 정보: 연습장 제목, 카드의 표현·상황·설명·메모, 녹음한 음성, 친구에게 남긴 피드백, 친구·차단 관계, 서버 초안 동기화를 켠 경우의 초안.',
        '자동으로 생기는 정보: 로그인 유지용 토큰, 반복된 로그인 시도를 막기 위한 IP 주소·이메일별 시도 횟수, 요청 시각·경로·결과 등 서버 운영 기록.',
        '문의를 보낼 때: 문의 내용, 답변받을 이메일(선택), 앱 버전과 브라우저 정보.',
        '위치, 연락처, 사진, 결제 정보, 기기 광고 식별자는 수집하지 않습니다. 마이크는 사용자가 녹음 버튼을 누를 때만 사용합니다.',
      ],
    },
    {
      heading: '이용 목적',
      items: [
        '계정 생성·로그인과 본인 확인, 비밀번호 재설정',
        '연습장·카드·녹음·피드백을 저장하고 함께 쓰기로 한 친구에게 보여 주는 서비스 제공',
        '부정 이용 방지, 신고 처리, 보안 사고와 장애 대응',
        '문의 응대',
      ],
    },
    {
      heading: '보유 기간과 파기',
      paragraphs: [
        '개인정보는 회원 탈퇴 시까지 보유하고, 탈퇴하면 지체 없이 파기합니다. 탈퇴하면 계정 정보, 내가 만든 연습장(그 안에 친구가 올린 카드와 녹음 포함), 친구 연습장에 올린 내 카드, 녹음, 초안, 친구·차단 관계가 삭제됩니다.',
        '다른 사람의 시도에 남긴 피드백과 다른 사람의 글에 남긴 교정은 받은 사람의 학습 기록이므로 남지만, 작성자와의 연결은 끊어져 누가 썼는지 알 수 없게 됩니다.',
        '카드나 연습장을 지우면 화면에서는 바로 사라지지만 저장된 음성 원본은 탈퇴할 때 함께 삭제됩니다. 그 전에 원본 삭제가 필요하면 아래로 요청해 주세요.',
      ],
      items: [
        '로그인 유지 토큰: 최대 30일',
        '로그인 시도 횟수: 15분',
        '서버 초안: 마지막 수정 후 7일',
        '내 데이터 내보내기 파일: 만든 뒤 24시간',
        '비밀번호 재설정 링크: 15분, 한 번만 사용',
        '서버 운영 기록: 보안과 장애 대응에 필요한 기간',
        '법령이 따로 보관을 요구하는 경우에는 그 기간 동안 분리해 보관합니다.',
      ],
    },
    {
      heading: '제3자 제공',
      paragraphs: ['운영자는 개인정보를 제3자에게 제공하지 않습니다. 법령에 근거해 수사기관 등이 적법한 절차로 요구하는 경우는 예외입니다.'],
    },
    {
      heading: '처리를 맡기는 곳과 국외 이전',
      paragraphs: ['서비스는 운영자가 직접 관리하는 서버에서 운영되며, 아래 업무에 한해 외부 서비스를 이용합니다. 이 과정에서 정보가 해외 서버를 거칠 수 있습니다.'],
      items: [
        'Cloudflare, Inc.(미국): 서비스 접속 경로와 보안. 서비스로 오가는 모든 요청이 전송 중 암호화된 상태로 Cloudflare를 거칩니다. 서비스 이용 기간 동안.',
        'Google LLC(미국): Google 로그인 확인, 비밀번호 재설정 메일 발송(Gmail). 이메일 주소와 재설정 링크가 전달됩니다.',
        'Apple Inc.(미국): Apple 로그인 확인.',
        '이전을 원하지 않으면 해당 로그인 방식을 쓰지 않거나 탈퇴할 수 있습니다. 다만 Cloudflare를 거치지 않고는 서비스를 이용할 수 없습니다.',
      ],
    },
    {
      heading: '이용자의 권리',
      items: [
        '열람·내려받기: 웹 프로필 → 내 데이터 내보내기',
        '정정: 프로필에서 닉네임과 언어 설정 수정',
        '삭제: 앱 프로필 → 설정 → 회원탈퇴, 또는 웹 프로필',
        `처리 정지와 그 밖의 요청: ${LEGAL_CONTACT_EMAIL}. 본인 확인 후 지체 없이 처리하고 결과를 알려 드립니다.`,
      ],
    },
    {
      heading: '쿠키와 브라우저 저장소',
      paragraphs: ['웹은 로그인 유지(refresh_token, HttpOnly), 로그인 상태 표시, 화면 언어를 위한 쿠키만 쓰고, 화면 테마와 작성 중인 초안은 브라우저 저장소에 둡니다. 광고·추적 쿠키는 쓰지 않습니다. 브라우저 설정에서 쿠키를 막으면 로그인이 유지되지 않습니다.'],
    },
    {
      heading: '안전성 확보 조치',
      items: [
        '모든 통신 HTTPS 암호화',
        '비밀번호와 로그인 유지 토큰은 복원할 수 없는 해시로 저장',
        '음성 파일은 비공개 저장소에 두고, 접근 권한이 있는 사용자에게만 15분짜리 임시 링크로 제공',
        '서버 접근은 운영자에게만 허용',
      ],
    },
    {
      heading: '아동의 개인정보',
      paragraphs: [`서비스는 만 ${LEGAL_MINIMUM_AGE}세 이상만 가입할 수 있습니다. 만 ${LEGAL_MINIMUM_AGE}세 미만의 정보가 수집된 사실을 알게 되면 지체 없이 삭제합니다.`],
    },
    {
      heading: '개인정보 보호책임자',
      paragraphs: [`${LEGAL_OPERATOR.ko} · ${LEGAL_CONTACT_EMAIL}. 개인정보 관련 문의, 불만, 피해 구제는 위 연락처로 보내 주세요.`],
    },
    {
      heading: '권익 침해 구제',
      items: [
        '개인정보침해신고센터 (privacy.kisa.or.kr, 국번 없이 118)',
        '개인정보분쟁조정위원회 (www.kopico.go.kr, 1833-6972)',
        '대검찰청 사이버수사과 (www.spo.go.kr, 국번 없이 1301)',
        '경찰청 사이버수사국 (ecrm.police.go.kr, 국번 없이 182)',
      ],
    },
    {
      heading: '처리방침 변경',
      paragraphs: ['내용이 바뀌면 시행 7일 전에 이 페이지에서 알립니다. 이용자에게 불리한 중요한 변경은 30일 전에 알립니다.'],
    },
  ],
}

const en: LegalDocumentContent = {
  title: 'Privacy Policy',
  intro: `${LEGAL_OPERATOR.en} ("we") handles the personal information of people who use the ToneBridge website and app (the "Service") under Korea's Personal Information Protection Act. The Service uses no advertising, analytics or crash-reporting tools, and we never sell personal information or combine it with data from other companies.`,
  sections: [
    {
      heading: 'Information we process',
      items: [
        'At sign-up (required): email address, nickname, and native, learning and interface language settings. Email sign-up also takes a password, which we store only as a one-way BCrypt hash.',
        'Sign in with Google: we keep only the email address Google verifies. We do not store your name or profile picture.',
        'Sign in with Apple: we keep your Apple user identifier and email address (Apple\'s relay address if you chose Hide My Email). We do not store your name.',
        'What you create: notebook titles; card phrases, context, explanations and notes; voice recordings; feedback you leave for friends; friend and block relationships; and drafts, if you turn on server draft sync.',
        'Created automatically: sign-in tokens, sign-in attempt counts per IP address and email to stop repeated guessing, and server operation records such as request time, path and result.',
        'When you contact us: your message, an optional reply email, and the app version and browser information.',
        'We do not collect location, contacts, photos, payment details or advertising identifiers. The microphone is used only while you press the record button.',
      ],
    },
    {
      heading: 'Why we use it',
      items: [
        'Creating your account, signing you in and resetting your password',
        'Storing your notebooks, cards, recordings and feedback, and showing them to the friends you share them with',
        'Preventing abuse, handling reports, and responding to security incidents and outages',
        'Answering your questions',
      ],
    },
    {
      heading: 'How long we keep it',
      paragraphs: [
        'We keep your information until you delete your account and destroy it without delay when you do. Deleting your account removes your account details, notebooks you created (including cards and recordings friends added to them), your cards in friends\' notebooks, your recordings, drafts, and friend and block relationships.',
        'Feedback you left on other people\'s attempts and corrections you wrote on their posts are part of their learning history, so they remain, but the link to you is removed and they can no longer be traced to you.',
        'Deleting a card or notebook removes it from the screen at once; the stored audio is deleted with your account. Contact us below if you need it erased sooner.',
      ],
      items: [
        'Sign-in tokens: up to 30 days',
        'Sign-in attempt counts: 15 minutes',
        'Server drafts: 7 days after the last edit',
        'Personal data export files: 24 hours after creation',
        'Password reset links: 15 minutes, single use',
        'Server operation records: as long as needed for security and incident response',
        'Where a law requires longer retention, we keep that data separately for the required period.',
      ],
    },
    {
      heading: 'Sharing with third parties',
      paragraphs: ['We do not provide personal information to third parties, except when a law requires it and authorities request it through due process.'],
    },
    {
      heading: 'Service providers and transfers abroad',
      paragraphs: ['The Service runs on servers we manage ourselves. We use outside services only for the tasks below, which may route information through servers outside Korea.'],
      items: [
        'Cloudflare, Inc. (USA): network delivery and security. Every request to the Service passes through Cloudflare, encrypted in transit, for as long as you use the Service.',
        'Google LLC (USA): verifying Google sign-in and sending password reset emails (Gmail). Your email address and the reset link are passed on.',
        'Apple Inc. (USA): verifying Sign in with Apple.',
        'If you do not want these transfers, you can avoid that sign-in method or delete your account. The Service cannot be used without passing through Cloudflare.',
      ],
    },
    {
      heading: 'Your rights',
      items: [
        'Access and download: web profile → Personal data export',
        'Correction: edit your nickname and language settings in your profile',
        'Deletion: in the app, Profile → Settings → Delete account; or on the web profile page',
        `Suspension of processing and other requests: ${LEGAL_CONTACT_EMAIL}. We act on them without delay after verifying your identity and tell you the result.`,
      ],
    },
    {
      heading: 'Cookies and browser storage',
      paragraphs: ['The website uses cookies only to keep you signed in (refresh_token, HttpOnly), to mark the signed-in state, and to remember your interface language. It keeps your theme and unsent drafts in browser storage. We use no advertising or tracking cookies. Blocking cookies stops you from staying signed in.'],
    },
    {
      heading: 'How we protect it',
      items: [
        'All traffic is encrypted with HTTPS',
        'Passwords and sign-in tokens are stored as one-way hashes',
        'Audio files sit in private storage and are served only to permitted users through links that expire after 15 minutes',
        'Only the operator can access the servers',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [`You must be at least ${LEGAL_MINIMUM_AGE} years old to sign up. If we learn that we hold information from a child under ${LEGAL_MINIMUM_AGE}, we delete it without delay.`],
    },
    {
      heading: 'Privacy officer',
      paragraphs: [`${LEGAL_OPERATOR.en} · ${LEGAL_CONTACT_EMAIL}. Send privacy questions, complaints and requests for remedy to this address.`],
    },
    {
      heading: 'Remedies',
      paragraphs: ['You can also contact the Korean authorities: the Personal Information Infringement Report Center (privacy.kisa.or.kr, 118), the Personal Information Dispute Mediation Committee (www.kopico.go.kr, 1833-6972), the Supreme Prosecutors\' Office cyber investigation (www.spo.go.kr, 1301), or the Korean National Police Agency cyber bureau (ecrm.police.go.kr, 182).'],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: ['We announce changes on this page 7 days before they take effect, or 30 days before for significant changes that work against you.'],
    },
  ],
}

export const PRIVACY_CONTENT: Record<LegalLanguage, LegalDocumentContent> = { ko, en }
