import 'package:freezed_annotation/freezed_annotation.dart';

import 'sound_target.dart';

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
    // Who wrote the feedback; lets the learner report it.
    String? correctionAuthorId,
    // Absent from servers before V35; mobile only displays these.
    @Default(<SoundTarget>[]) List<SoundTarget> soundTargets,
  }) = _LearnerAttempt;

  const LearnerAttempt._();

  factory LearnerAttempt.fromJson(Map<String, dynamic> json) =>
      _$LearnerAttemptFromJson(json);

  bool get isCorrected => correctionNote != null && correctionNote!.isNotEmpty;
}
