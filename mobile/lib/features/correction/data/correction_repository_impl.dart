import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/correction/domain/correction_repository.dart';
import 'package:tonebridge/features/correction/domain/model/correction_item.dart';

part 'correction_repository_impl.g.dart';

@riverpod
CorrectionRepository correctionRepository(Ref ref) =>
    CorrectionRepositoryImpl(dio: ref.watch(dioProvider));

class CorrectionRepositoryImpl implements CorrectionRepository {
  const CorrectionRepositoryImpl({required Dio dio}) : _dio = dio;
  final Dio _dio;

  @override
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
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/corrections',
      data: {
        'requestId': requestId,
        if (correctedText != null) 'correctedText': correctedText,
        'explanation': explanation,
        'tags': tags,
        'timestampComments':
            timestampComments.map((t) => t.toJson()).toList(),
        if (pronunciationScore != null) 'pronunciationScore': pronunciationScore,
        if (intonationScore != null) 'intonationScore': intonationScore,
        if (fluencyScore != null) 'fluencyScore': fluencyScore,
        if (referenceAudioUrl != null) 'referenceAudioUrl': referenceAudioUrl,
      },
    );
    return CorrectionItem.fromJson(response.data!);
  }

  @override
  Future<List<CorrectionItem>> getCorrectionResult(String requestId) async {
    final response = await _dio.get<List<dynamic>>(
      '/api/corrections/request/$requestId',
    );
    return response.data!
        .map((e) => CorrectionItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> rateCorrection(String correctionId,
      {required bool helpful}) async {
    await _dio.post<void>(
      '/api/corrections/$correctionId/rate',
      data: {'helpful': helpful},
    );
  }
}
