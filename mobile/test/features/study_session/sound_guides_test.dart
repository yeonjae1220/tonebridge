import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:tonebridge/features/study_session/domain/model/learner_attempt.dart';
import 'package:tonebridge/features/study_session/domain/sound_guides.dart';

void main() {
  test('mobile guides match the ids the server accepts and the web renders', () {
    // Shared list, also checked by the backend (SoundGuideCatalogTest) and the web e2e suite.
    final shared = File('../frontend/src/lib/soundGuideIds.json');
    final ids = (jsonDecode(shared.readAsStringSync()) as List).cast<String>();

    expect(soundGuides.map((guide) => guide.id).toList(), ids);
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
