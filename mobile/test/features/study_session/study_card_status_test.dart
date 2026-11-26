import 'package:flutter_test/flutter_test.dart';
import 'package:tonebridge/features/study_session/domain/model/study_card.dart';

import '../../helpers/mocks.dart';

void main() {
  group('StudyCard.cardStatus', () {
    test('is noAudio when nothing has been recorded', () {
      expect(makeStudyCard().cardStatus, CardStatus.noAudio);
    });

    // Example voices now live in /native-audios and the card's legacy
    // nativeAudioUrl stays null, so the attempt alone has to drive the status.
    test('is recorded when an uncorrected attempt exists', () {
      final card = makeStudyCard(latestAttempt: makeLearnerAttempt());

      expect(card.cardStatus, CardStatus.recorded);
    });

    test('is corrected when the latest attempt has feedback', () {
      final card = makeStudyCard(
        latestAttempt: makeLearnerAttempt(correctionNote: 'Good!', score: 4),
      );

      expect(card.cardStatus, CardStatus.corrected);
    });

    test('keeps legacy cards with only nativeAudioUrl as recorded', () {
      final card = makeStudyCard(nativeAudioUrl: 'audio/legacy.m4a');

      expect(card.cardStatus, CardStatus.recorded);
    });
  });
}
