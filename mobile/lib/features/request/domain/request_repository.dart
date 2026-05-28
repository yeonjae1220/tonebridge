import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';

abstract interface class RequestRepository {
  Future<CorrectionRequestItem> submitTextRequest({
    required String targetLanguage,
    String? targetVariant,
    required String contentText,
    String? context,
    List<String> feedbackGoals = const [],
  });

  Future<CorrectionRequestItem> submitAudioRequest({
    required String targetLanguage,
    String? targetVariant,
    required String audioKey,
    String? context,
    List<String> feedbackGoals = const [],
  });

  Future<CorrectionRequestItem> updateRequest({
    required String requestId,
    required String targetLanguage,
    String? targetVariant,
    String? contentText,
    String? context,
    List<String> feedbackGoals = const [],
  });

  Future<void> deleteRequest(String requestId);
}
