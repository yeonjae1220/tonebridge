import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/feed/data/feed_repository_impl.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';
import 'package:tonebridge/features/request/data/request_repository_impl.dart';

part 'feed_provider.g.dart';

@riverpod
class FeedState extends _$FeedState {
  @override
  Future<List<CorrectionRequestItem>> build() =>
      ref.watch(feedRepositoryProvider).getFeed();

  Future<void> refresh() {
    ref.invalidateSelf();
    return future;
  }
}

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
