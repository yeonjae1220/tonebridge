import 'dart:ui' show Offset;

/// How the tongue relates to the marked spot.
enum ContactKind { touch, tap, near }

/// One pronunciation guide. Mirrors frontend/src/lib/soundGuides.ts (Korean text only, as the
/// rest of the app). frontend/src/lib/soundGuides.json is the source; a test fails if any id,
/// symbol, coordinate or Korean text here differs from it.
class SoundGuide {
  const SoundGuide({
    required this.id,
    required this.symbol,
    required this.title,
    required this.steps,
    required this.tongue,
    required this.contact,
    required this.contactKind,
  });

  final String id;
  final String symbol;
  final String title;
  final List<String> steps;

  /// Tongue outline in the diagram space (220 x 200, face pointing left):
  /// tip, blade, dorsum, back, root, base, underside, underside front.
  final List<Offset> tongue;
  final Offset contact;
  final ContactKind contactKind;
}

const restTongue = [
  Offset(80, 124),
  Offset(98, 112),
  Offset(128, 104),
  Offset(160, 116),
  Offset(172, 150),
  Offset(150, 176),
  Offset(110, 168),
  Offset(86, 142),
];

const soundGuides = <SoundGuide>[
  SoundGuide(
    id: 'en-th',
    symbol: 'θ',
    title: '영어 th',
    steps: [
      '혀끝을 윗니와 아랫니 사이로 살짝 내밉니다.',
      '혀를 떼지 않은 채 그 틈으로 바람을 계속 내보냅니다.',
      'think는 목을 울리지 않고, this는 같은 자리에서 목을 울립니다.',
    ],
    tongue: [
      Offset(61, 117),
      Offset(84, 111),
      Offset(126, 106),
      Offset(160, 118),
      Offset(172, 150),
      Offset(150, 176),
      Offset(108, 168),
      Offset(78, 126),
    ],
    contact: Offset(64, 115),
    contactKind: ContactKind.touch,
  ),
  SoundGuide(
    id: 'en-r',
    symbol: 'ɹ',
    title: '영어 r',
    steps: [
      '혀끝을 윗잇몸 뒤쪽으로 들어 올리되 어디에도 닿지 않게 합니다.',
      '혀 양옆은 위쪽 어금니에 가볍게 붙입니다.',
      '입술을 살짝 둥글게 모읍니다. 혀끝이 닿으면 ㄹ처럼 들립니다.',
    ],
    tongue: [
      Offset(98, 94),
      Offset(108, 108),
      Offset(134, 100),
      Offset(164, 114),
      Offset(172, 150),
      Offset(150, 176),
      Offset(108, 166),
      Offset(92, 114),
    ],
    contact: Offset(98, 87),
    contactKind: ContactKind.near,
  ),
  SoundGuide(
    id: 'en-l',
    symbol: 'l',
    title: '영어 l',
    steps: [
      '혀끝을 윗니 바로 뒤 잇몸에 단단히 붙입니다.',
      '혀끝을 붙인 채 소리를 내면 공기가 혀 양옆으로 빠져나갑니다.',
      '소리가 끝날 때까지 혀끝을 떼지 않습니다.',
    ],
    tongue: [
      Offset(80, 97),
      Offset(94, 108),
      Offset(128, 110),
      Offset(160, 120),
      Offset(172, 150),
      Offset(150, 176),
      Offset(110, 168),
      Offset(88, 122),
    ],
    contact: Offset(80, 95),
    contactKind: ContactKind.touch,
  ),
  SoundGuide(
    id: 'ko-rieul',
    symbol: 'ㄹ',
    title: '한국어 ㄹ',
    steps: [
      '모음 사이(나라, 우리)에서는 혀끝으로 윗잇몸을 한 번 가볍게 치고 바로 뗍니다.',
      '받침(말, 달)에서는 혀끝을 윗잇몸에 붙인 채 유지합니다.',
      '혀를 뒤로 말지 않습니다.',
    ],
    tongue: [
      Offset(81, 97),
      Offset(95, 109),
      Offset(128, 108),
      Offset(160, 118),
      Offset(172, 150),
      Offset(150, 176),
      Offset(110, 168),
      Offset(88, 124),
    ],
    contact: Offset(81, 95),
    contactKind: ContactKind.tap,
  ),
];

/// Sounds one piece of feedback may point at; the server enforces the same limit.
const maxFeedbackSounds = 3;

SoundGuide? soundGuideById(String id) {
  for (final guide in soundGuides) {
    if (guide.id == id) return guide;
  }
  return null;
}

String contactLabel(ContactKind kind) => switch (kind) {
  ContactKind.touch => '혀끝이 닿는 곳',
  ContactKind.tap => '혀끝이 한 번 치는 곳',
  ContactKind.near => '닿지 않고 가까이 가는 곳',
};
