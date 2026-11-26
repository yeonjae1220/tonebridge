import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:tonebridge/features/study_session/domain/model/learner_attempt.dart';

part 'study_card.freezed.dart';
part 'study_card.g.dart';

enum CardStatus { noAudio, recorded, corrected }

@freezed
abstract class StudyCard with _$StudyCard {
  const factory StudyCard({
    required String id,
    required String sessionId,
    required String createdByUserId,
    required String phrase,
    String? context,
    String? nativeAudioUrl,
    String? explanation,
    @Default([]) List<String> tags,
    @Default(0) int position,
    required DateTime createdAt,
    LearnerAttempt? latestAttempt,
    String? note,
  }) = _StudyCard;

  const StudyCard._();

  static const maxPhraseLength = 500;
  static const phraseLengthHelp = '표현은 최대 ${maxPhraseLength}자까지 저장할 수 있어요.';

  factory StudyCard.fromJson(Map<String, dynamic> json) =>
      _$StudyCardFromJson(json);

  /// Example voices moved to the card's native-audio list and no longer set
  /// [nativeAudioUrl], so the latest attempt decides; the legacy field only
  /// keeps older cards from regressing to [CardStatus.noAudio].
  CardStatus get cardStatus {
    if (latestAttempt?.isCorrected == true) return CardStatus.corrected;
    if (latestAttempt != null || nativeAudioUrl != null) {
      return CardStatus.recorded;
    }
    return CardStatus.noAudio;
  }
}
