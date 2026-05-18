import 'package:tonebridge/features/correction/domain/model/correction_item.dart';

abstract interface class CorrectionRepository {
  Future<CorrectionItem> submitCorrection({
    required String requestId,
    String? correctedText,
    required String explanation,
    List<String> tags = const [],
    List<TimestampComment> timestampComments = const [],
    int? pronunciationScore,
    int? intonationScore,
    int? fluencyScore,
    String? referenceAudioUrl,
  });

  Future<List<CorrectionItem>> getCorrectionResult(String requestId);

  Future<void> rateCorrection(String correctionId, {required bool helpful});
}
