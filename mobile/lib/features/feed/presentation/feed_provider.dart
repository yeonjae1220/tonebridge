import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/feed/data/feed_repository_impl.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';
import 'package:tonebridge/features/request/data/request_repository_impl.dart';

part 'feed_provider.g.dart';

/// 피드에 지금까지 불러온 요청과 다음 페이지 상태.
class FeedPageData {
  const FeedPageData({
    required this.items,
    required this.nextCursor,
    this.isLoadingMore = false,
    this.loadMoreError,
  });

  final List<CorrectionRequestItem> items;
  final String? nextCursor;
  final bool isLoadingMore;

  /// 다음 페이지 불러오기 실패. 이미 보이는 목록은 그대로 두고 실패만 따로 알린다.
  final Object? loadMoreError;

  bool get hasMore => nextCursor != null;
}

@riverpod
class FeedState extends _$FeedState {
  @override
  Future<FeedPageData> build() async {
    final page = await ref.watch(feedRepositoryProvider).getFeedPage();
    return FeedPageData(items: page.items, nextCursor: page.nextCursor);
  }

  Future<void> refresh() {
    ref.invalidateSelf();
    return future;
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.isLoadingMore) return;
    state = AsyncData(FeedPageData(
      items: current.items,
      nextCursor: current.nextCursor,
      isLoadingMore: true,
    ));
    try {
      final page = await ref
          .read(feedRepositoryProvider)
          .getFeedPage(before: current.nextCursor);
      if (!ref.mounted) return;
      state = AsyncData(FeedPageData(
        items: [...current.items, ...page.items],
        nextCursor: page.nextCursor,
      ));
    } catch (e, st) {
      debugPrint('[FeedState] loadMore failed: $e\n$st');
      if (!ref.mounted) return;
      state = AsyncData(FeedPageData(
        items: current.items,
        nextCursor: current.nextCursor,
        loadMoreError: e,
      ));
    }
  }
}

/// 요청 단건 — 교정·결과 화면용. 예전엔 피드·내 요청 목록에서 id 로 찾아서,
/// 피드를 페이지로 나누면 목록에 없는 요청을 못 열었다.
@riverpod
Future<CorrectionRequestItem> correctionRequest(Ref ref, String requestId) =>
    ref.watch(feedRepositoryProvider).getRequest(requestId);

@riverpod
class MyRequestsState extends _$MyRequestsState {
  @override
  Future<List<CorrectionRequestItem>> build() =>
      ref.watch(feedRepositoryProvider).getMyRequests();

  Future<void> refresh() {
    ref.invalidateSelf();
    return future;
  }

  Future<void> deleteRequest(String requestId) async {
    await ref.read(requestRepositoryProvider).deleteRequest(requestId);
    ref.invalidateSelf();
    ref.invalidate(feedStateProvider);
  }

  Future<CorrectionRequestItem> updateRequest({
    required String requestId,
    required String targetLanguage,
    String? targetVariant,
    String? contentText,
    String? context,
    List<String> feedbackGoals = const [],
  }) async {
    final updated = await ref.read(requestRepositoryProvider).updateRequest(
          requestId: requestId,
          targetLanguage: targetLanguage,
          targetVariant: targetVariant,
          contentText: contentText,
          context: context,
          feedbackGoals: feedbackGoals,
        );
    ref.invalidateSelf();
    ref.invalidate(feedStateProvider);
    return updated;
  }
}
