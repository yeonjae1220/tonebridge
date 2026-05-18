import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/feed/data/feed_repository_impl.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';

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
}
