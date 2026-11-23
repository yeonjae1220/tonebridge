import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:tonebridge/features/study_session/domain/model/learner_attempt.dart';
import 'package:tonebridge/features/study_session/domain/sound_guides.dart';

void main() {
  // frontend/src/lib/soundGuides.json is the single source; the backend allow-list is checked
  // against it too. Here every id, symbol, coordinate and Korean string must match.
  final shared =
      jsonDecode(File('../frontend/src/lib/soundGuides.json').readAsStringSync())
          as Map<String, dynamic>;
  List<List<num>> points(List<Offset> offsets) => [
    for (final o in offsets) [o.dx, o.dy],
  ];

  test('mobile guides match the shared guide file exactly', () {
    final guides = (shared['guides'] as List).cast<Map<String, dynamic>>();
    expect(soundGuides.map((g) => g.id).toList(), [
      for (final g in guides) g['id'],
    ]);
    for (final (index, json) in guides.indexed) {
      final guide = soundGuides[index];
      final ko = (json['text'] as Map)['ko'] as Map;
      final contact = json['contact'] as Map;
      expect(guide.symbol, json['symbol'], reason: guide.id);
      expect(guide.title, ko['title'], reason: guide.id);
      expect(guide.steps, ko['steps'], reason: guide.id);
      expect(points(guide.tongue), json['tongue'], reason: guide.id);
      expect([guide.contact.dx, guide.contact.dy], contact['at'], reason: guide.id);
      expect(guide.contactKind.name, contact['kind'], reason: guide.id);
    }
    expect(points(restTongue), shared['restTongue']);
  });

  test('every guide has a full tongue outline and steps', () {
    for (final guide in soundGuides) {
      expect(guide.tongue, hasLength(restTongue.length), reason: guide.id);
      expect(guide.steps, isNotEmpty, reason: guide.id);
    }
  });

  test(
    'attempts parse soundTargets, and older responses without the field get none',
    () {
      final base = {
        'id': 'attempt-1',
        'cardId': 'card-1',
        'learnerId': 'learner-1',
        'audioUrl': 'practice.webm',
        'correctionNote': 'th 가 s 처럼 들려요.',
        'score': 3,
        'attemptedAt': '2026-11-21T00:00:00Z',
        // Fields the mobile model does not declare must not break parsing.
        'correctionAuthorId': 'friend-1',
      };

      final withTargets = LearnerAttempt.fromJson({
        ...base,
        'soundTargets': [
          {'guideId': 'en-th'},
          {'guideId': 'ko-rieul'},
        ],
      });
      expect(withTargets.soundTargets.map((t) => t.guideId), [
        'en-th',
        'ko-rieul',
      ]);

      expect(LearnerAttempt.fromJson(base).soundTargets, isEmpty);
    },
  );
}
