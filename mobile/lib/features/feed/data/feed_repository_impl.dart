import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/feed/domain/feed_repository.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';
import 'package:tonebridge/features/feed/domain/model/feed_page_result.dart';

part 'feed_repository_impl.g.dart';

@riverpod
FeedRepository feedRepository(Ref ref) =>
    FeedRepositoryImpl(dio: ref.watch(dioProvider));

class FeedRepositoryImpl implements FeedRepository {
  const FeedRepositoryImpl({required Dio dio}) : _dio = dio;
  final Dio _dio;

  @override
  Future<FeedPageResult> getFeedPage({String? before, int limit = 20}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/correction-requests/feed/page',
      queryParameters: {'limit': limit, 'before': ?before},
    );
    final body = response.data;
    // 빈 본문을 빈 목록으로 바꾸면 '조회 실패'가 '요청 없음'으로 보인다 — 실패로 올린다.
    if (body == null) {
      throw StateError('feed page response has no body');
    }
    final items = (body['items'] as List<dynamic>)
        .map((e) => CorrectionRequestItem.fromJson(e as Map<String, dynamic>))
        .toList();
    return FeedPageResult(items: items, nextCursor: body['nextCursor'] as String?);
  }

  @override
  Future<CorrectionRequestItem> getRequest(String requestId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/correction-requests/$requestId',
    );
    final body = response.data;
    if (body == null) {
      throw StateError('correction request $requestId response has no body');
    }
    return CorrectionRequestItem.fromJson(body);
  }

  @override
  Future<List<CorrectionRequestItem>> getMyRequests() async {
    final response = await _dio.get<List<dynamic>>('/api/correction-requests/mine');
    return response.data!
        .map((e) => CorrectionRequestItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
