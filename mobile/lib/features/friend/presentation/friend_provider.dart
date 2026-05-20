import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/friend/data/friend_repository_impl.dart';
import 'package:tonebridge/features/friend/domain/model/friend.dart';

part 'friend_provider.g.dart';

@riverpod
class FriendListState extends _$FriendListState {
  @override
  Future<List<Friend>> build() =>
      ref.watch(friendRepositoryProvider).getFriends();

  Future<void> refresh() {
    ref.invalidateSelf();
    return future;
  }

  Future<void> sendRequest(String username) async {
    await ref.read(friendRepositoryProvider).sendRequest(username);
    await refresh();
  }

  Future<void> acceptRequest(String requestId) async {
    await ref.read(friendRepositoryProvider).acceptRequest(requestId);
    ref.invalidate(pendingFriendRequestsProvider);
    await refresh();
  }

  Future<void> declineRequest(String requestId) async {
    await ref.read(friendRepositoryProvider).declineRequest(requestId);
    ref.invalidate(pendingFriendRequestsProvider);
  }

  Future<void> removeFriend(String friendId) async {
    await ref.read(friendRepositoryProvider).removeFriend(friendId);
    await refresh();
  }
}

@riverpod
Future<List<FriendRequestItem>> pendingFriendRequests(Ref ref) =>
    ref.watch(friendRepositoryProvider).getPendingRequests();
