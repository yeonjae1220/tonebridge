import 'package:freezed_annotation/freezed_annotation.dart';

part 'correction_item.freezed.dart';
part 'correction_item.g.dart';

@freezed
abstract class CorrectionItem with _$CorrectionItem {
  const factory CorrectionItem({
    required String id,
    required String requestId,
    String? correctorId,
    @Default(false) bool isAi,
    String? correctedText,
    String? explanation,
    @Default([]) List<String> tags,
    @Default([]) List<TimestampComment> timestampComments,
    int? pronunciationScore,
    int? intonationScore,
    int? fluencyScore,
    String? referenceAudioUrl,
    @Default(0) int creditEarned,
    required String status,
    required DateTime createdAt,
  }) = _CorrectionItem;

  factory CorrectionItem.fromJson(Map<String, dynamic> json) =>
      _$CorrectionItemFromJson(json);
}

@freezed
abstract class TimestampComment with _$TimestampComment {
  const factory TimestampComment({
    required int offsetMs,
    required String comment,
  }) = _TimestampComment;

  factory TimestampComment.fromJson(Map<String, dynamic> json) =>
      _$TimestampCommentFromJson(json);
}
