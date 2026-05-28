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

  factory StudyCard.fromJson(Map<String, dynamic> json) =>
      _$StudyCardFromJson(json);

  CardStatus get cardStatus {
    if (nativeAudioUrl == null) return CardStatus.noAudio;
    if (latestAttempt?.isCorrected == true) return CardStatus.corrected;
    return CardStatus.recorded;
  }
}
