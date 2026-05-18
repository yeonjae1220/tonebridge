import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/feed/domain/feed_repository.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';

part 'feed_repository_impl.g.dart';

@riverpod
FeedRepository feedRepository(Ref ref) =>
    FeedRepositoryImpl(dio: ref.watch(dioProvider));

class FeedRepositoryImpl implements FeedRepository {
  const FeedRepositoryImpl({required Dio dio}) : _dio = dio;
  final Dio _dio;

  @override
  Future<List<CorrectionRequestItem>> getFeed({int limit = 20}) async {
    final response = await _dio.get<List<dynamic>>(
      '/api/correction-requests/feed',
      queryParameters: {'limit': limit},
    );
    return response.data!
        .map((e) => CorrectionRequestItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<CorrectionRequestItem>> getMyRequests() async {
    final response = await _dio.get<List<dynamic>>('/api/correction-requests/mine');
    return response.data!
        .map((e) => CorrectionRequestItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
