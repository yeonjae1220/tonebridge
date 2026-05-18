import 'package:freezed_annotation/freezed_annotation.dart';

part 'correction_request_item.freezed.dart';
part 'correction_request_item.g.dart';

@freezed
abstract class CorrectionRequestItem with _$CorrectionRequestItem {
  const factory CorrectionRequestItem({
    required String id,
    required String requesterId,
    required String type,
    String? contentText,
    String? audioUrl,
    required String targetLanguage,
    String? targetVariant,
    String? context,
    @Default([]) List<String> feedbackGoals,
    required int creditCost,
    required String status,
    required DateTime createdAt,
    DateTime? expiresAt,
  }) = _CorrectionRequestItem;

  factory CorrectionRequestItem.fromJson(Map<String, dynamic> json) =>
      _$CorrectionRequestItemFromJson(json);
}
