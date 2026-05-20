import 'package:freezed_annotation/freezed_annotation.dart';

part 'learner_attempt.freezed.dart';
part 'learner_attempt.g.dart';

@freezed
abstract class LearnerAttempt with _$LearnerAttempt {
  const factory LearnerAttempt({
    required String id,
    required String cardId,
    required String learnerId,
    required String audioUrl,
    String? correctionNote,
    int? score,
    required DateTime attemptedAt,
  }) = _LearnerAttempt;

  const LearnerAttempt._();

  factory LearnerAttempt.fromJson(Map<String, dynamic> json) =>
      _$LearnerAttemptFromJson(json);

  bool get isCorrected =>
      correctionNote != null && correctionNote!.isNotEmpty;
}
