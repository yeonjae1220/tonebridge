import 'package:tonebridge/features/friend/domain/model/friend.dart';
import 'package:tonebridge/features/friend/domain/model/user_search_result.dart';

abstract interface class FriendRepository {
  Future<List<Friend>> getFriends();
  Future<List<FriendRequestItem>> getPendingRequests();
  Future<List<UserSearchResult>> searchUsers(String query);
  Future<FriendRequestItem> sendRequest(String receiverUsername);
  Future<FriendRequestItem> acceptRequest(String requestId);
  Future<void> declineRequest(String requestId);
  Future<void> removeFriend(String friendId);
}
