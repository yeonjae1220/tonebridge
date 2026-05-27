import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';
import 'package:tonebridge/features/request/domain/request_repository.dart';

part 'request_repository_impl.g.dart';

@riverpod
RequestRepository requestRepository(Ref ref) =>
    RequestRepositoryImpl(dio: ref.watch(dioProvider));

class RequestRepositoryImpl implements RequestRepository {
  const RequestRepositoryImpl({required Dio dio}) : _dio = dio;
  final Dio _dio;

  @override
  Future<CorrectionRequestItem> submitTextRequest({
    required String targetLanguage,
    String? targetVariant,
    required String contentText,
    String? context,
    List<String> feedbackGoals = const [],
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/correction-requests',
      data: {
        'targetLanguage': targetLanguage,
        if (targetVariant != null) 'targetVariant': targetVariant,
        'contentText': contentText,
        if (context != null) 'context': context,
        'feedbackGoals': feedbackGoals,
      },
    );
    return CorrectionRequestItem.fromJson(response.data!);
  }

  @override
  Future<CorrectionRequestItem> submitAudioRequest({
    required String targetLanguage,
    String? targetVariant,
    required String audioKey,
    String? context,
    List<String> feedbackGoals = const [],
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/correction-requests/audio',
      data: {
        'targetLanguage': targetLanguage,
        if (targetVariant != null) 'targetVariant': targetVariant,
        'audioKey': audioKey,
        if (context != null) 'context': context,
        'feedbackGoals': feedbackGoals,
      },
    );
    return CorrectionRequestItem.fromJson(response.data!);
  }
}
