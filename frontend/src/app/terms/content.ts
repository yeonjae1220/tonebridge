import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_MINIMUM_AGE,
  LEGAL_OPERATOR,
  type LegalDocumentContent,
  type LegalLanguage,
} from '@/lib/legal'

// App Store guideline 1.2 requires terms with zero tolerance for objectionable content,
// a way to report and block, and an operator contact. Keep those three in this text.

const ko: LegalDocumentContent = {
  title: '이용약관',
  intro: `이 약관은 ${LEGAL_OPERATOR.ko}(이하 "운영자")가 제공하는 ToneBridge 웹과 앱(이하 "서비스")의 이용 조건을 정합니다. 가입하거나 서비스를 이용하면 이 약관과 개인정보 처리방침에 동의한 것으로 봅니다.`,
  sections: [
    {
      heading: '서비스',
      paragraphs: ['ToneBridge는 친구와 표현·예시 음성·연습 녹음·피드백을 주고받으며 언어를 배우는 서비스입니다. 현재 무료로 제공하며 앱 안에서 결제하는 기능은 없습니다. 운영자는 서비스를 개선하기 위해 기능을 바꾸거나 중단할 수 있고, 중요한 변경은 미리 알립니다.'],
    },
    {
      heading: '가입 자격과 계정',
      items: [
        `만 ${LEGAL_MINIMUM_AGE}세 이상만 가입할 수 있습니다.`,
        '정확한 정보로 가입하고, 계정과 비밀번호는 본인이 관리해야 합니다. 다른 사람의 계정을 쓰거나 내 계정을 넘겨서는 안 됩니다.',
        '계정이 도용된 것 같으면 바로 비밀번호를 바꾸고 운영자에게 알려 주세요.',
        '언제든 앱 프로필 → 설정 → 회원탈퇴 또는 웹 프로필에서 탈퇴할 수 있습니다.',
      ],
    },
    {
      heading: '이용자가 올리는 콘텐츠',
      paragraphs: [
        '표현, 녹음, 피드백 등 이용자가 올린 콘텐츠의 권리는 이용자에게 있습니다. 이용자는 운영자가 그 콘텐츠를 저장하고, 이용자가 함께 쓰기로 한 친구에게 보여 주는 등 서비스 제공에 필요한 범위에서 이용하도록 허락합니다. 이 허락은 콘텐츠를 삭제하거나 탈퇴하면 끝납니다. 다만 다른 사람에게 남긴 피드백은 작성자 연결을 끊은 채 받은 사람의 기록으로 남습니다.',
        '다른 사람의 목소리를 녹음하거나 다른 사람의 저작물을 올리려면 그 사람의 허락이 있어야 합니다.',
      ],
    },
    {
      heading: '금지 행위 — 무관용 원칙',
      paragraphs: ['아래 콘텐츠와 행위는 어떤 경우에도 허용하지 않습니다. 확인되면 사전 경고 없이 콘텐츠를 삭제하고 계정 이용을 제한하거나 해지하며, 필요하면 수사기관에 알립니다.'],
      items: [
        '괴롭힘, 위협, 스토킹, 따돌림',
        '인종·민족·국적·종교·성별·성적 지향·장애 등을 이유로 한 혐오 표현과 차별',
        '음란물, 성적인 콘텐츠, 미성년자를 성적으로 다루는 모든 콘텐츠',
        '폭력을 부추기거나 미화하는 콘텐츠, 자해·자살을 조장하는 콘텐츠',
        '불법 행위, 다른 사람의 개인정보·저작권·초상권·음성권 침해',
        '다른 사람이나 운영자를 사칭하는 행위',
        '스팸, 광고, 사기, 악성 코드',
        '서비스를 해킹하거나 비정상적인 방법으로 접근·부하를 주는 행위',
      ],
    },
    {
      heading: '신고와 차단',
      items: [
        '불쾌하거나 금지된 콘텐츠·이용자를 발견하면 서비스 안의 신고 기능이나 아래 이메일로 신고해 주세요.',
        '운영자는 신고를 받으면 24시간 안에 검토하고, 위반이 확인되면 콘텐츠를 삭제하고 작성자의 이용을 제한합니다.',
        '원하지 않는 이용자는 언제든 차단할 수 있습니다. 차단하면 친구 관계와 대기 중인 요청이 정리되고, 두 사람의 공유 연습장 접근과 상호작용이 중단됩니다.',
      ],
    },
    {
      heading: '이용 제한과 해지',
      paragraphs: ['이용자가 이 약관을 어기면 운영자는 콘텐츠 삭제, 기능 제한, 계정 해지를 할 수 있습니다. 조치에 이의가 있으면 아래 이메일로 알려 주세요. 검토 후 답변합니다.'],
    },
    {
      heading: '책임의 한계',
      items: [
        '서비스는 무료로 "있는 그대로" 제공합니다. 운영자는 서비스가 끊김 없이 동작하거나 학습 효과가 있음을 보장하지 않습니다.',
        '친구가 남긴 피드백 등 이용자가 올린 콘텐츠의 정확성에 대해서는 그 콘텐츠를 올린 이용자가 책임집니다.',
        '운영자는 고의 또는 중대한 과실이 없는 한 서비스 이용으로 생긴 손해에 책임지지 않습니다. 다만 관련 법령이 이 제한을 허용하지 않는 범위에서는 그렇지 않습니다.',
      ],
    },
    {
      heading: '약관 변경',
      paragraphs: ['약관을 바꾸면 시행 7일 전에, 이용자에게 불리한 변경은 30일 전에 서비스에서 알립니다. 변경 후에도 계속 이용하면 바뀐 약관에 동의한 것으로 봅니다. 동의하지 않으면 탈퇴할 수 있습니다.'],
    },
    {
      heading: '준거법과 문의',
      paragraphs: [`이 약관은 대한민국 법을 따르며, 분쟁은 민사소송법에 따른 관할 법원에서 해결합니다. 문의와 신고: ${LEGAL_CONTACT_EMAIL}`],
    },
  ],
}

const en: LegalDocumentContent = {
  title: 'Terms of Service',
  intro: `These terms set the conditions for using the ToneBridge website and app (the "Service") provided by ${LEGAL_OPERATOR.en} ("we"). By signing up or using the Service you agree to these terms and the Privacy Policy.`,
  sections: [
    {
      heading: 'The Service',
      paragraphs: ['ToneBridge helps friends learn each other\'s languages by exchanging phrases, example voices, practice recordings and feedback. It is currently free and has no in-app purchases. We may change or discontinue features to improve the Service and will announce significant changes in advance.'],
    },
    {
      heading: 'Eligibility and accounts',
      items: [
        `You must be at least ${LEGAL_MINIMUM_AGE} years old to sign up.`,
        'Sign up with accurate information and keep your account and password secure. Do not use someone else\'s account or hand yours over.',
        'If you think your account has been compromised, change your password at once and let us know.',
        'You can delete your account at any time: in the app, Profile → Settings → Delete account; or on the web profile page.',
      ],
    },
    {
      heading: 'Your content',
      paragraphs: [
        'You keep the rights to the phrases, recordings, feedback and other content you post. You allow us to use it only as needed to run the Service, such as storing it and showing it to the friends you share it with. This permission ends when you delete the content or your account, except that feedback you left for others remains in their history without a link to you.',
        'Do not record someone else\'s voice or post someone else\'s work without their permission.',
      ],
    },
    {
      heading: 'Prohibited conduct — zero tolerance',
      paragraphs: ['The content and behavior below are never allowed. When we confirm a violation we remove the content and restrict or terminate the account without prior warning, and report it to the authorities where appropriate.'],
      items: [
        'Harassment, threats, stalking or bullying',
        'Hate speech or discrimination based on race, ethnicity, nationality, religion, gender, sexual orientation, disability or similar grounds',
        'Pornography, sexual content, or any content that sexualizes minors',
        'Content that incites or glorifies violence, or encourages self-harm or suicide',
        'Illegal activity, or violating other people\'s privacy, copyright, likeness or voice rights',
        'Impersonating another person or the operator',
        'Spam, advertising, fraud or malware',
        'Hacking the Service, or accessing or loading it by abnormal means',
      ],
    },
    {
      heading: 'Reporting and blocking',
      items: [
        'If you see objectionable or prohibited content or users, report them with the in-app report feature or by email below.',
        'We review reports within 24 hours. When a violation is confirmed we remove the content and restrict the author.',
        'You can block anyone at any time. Blocking ends the friendship and pending requests, closes access to notebooks you shared, and stops interactions between you.',
      ],
    },
    {
      heading: 'Restriction and termination',
      paragraphs: ['If you break these terms we may remove content, limit features or terminate your account. If you disagree with an action, email us and we will review it and reply.'],
    },
    {
      heading: 'Limitation of liability',
      items: [
        'The Service is free and provided "as is". We do not guarantee that it will run without interruption or improve your language skills.',
        'Users are responsible for the accuracy of the content they post, including feedback from friends.',
        'We are not liable for damage arising from use of the Service unless caused by our intent or gross negligence, except where applicable law does not allow this limitation.',
      ],
    },
    {
      heading: 'Changes to these terms',
      paragraphs: ['We announce changes in the Service 7 days before they take effect, or 30 days before for changes that work against you. Continuing to use the Service after a change means you accept it; if you do not, you can delete your account.'],
    },
    {
      heading: 'Governing law and contact',
      paragraphs: [`These terms are governed by the laws of the Republic of Korea, and disputes go to the court with jurisdiction under the Korean Civil Procedure Act. Questions and reports: ${LEGAL_CONTACT_EMAIL}`],
    },
  ],
}

export const TERMS_CONTENT: Record<LegalLanguage, LegalDocumentContent> = { ko, en }
