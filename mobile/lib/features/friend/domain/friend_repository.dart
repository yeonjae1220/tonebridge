import 'package:tonebridge/features/friend/domain/model/friend.dart';

abstract interface class FriendRepository {
  Future<List<Friend>> getFriends();
  Future<List<FriendRequestItem>> getPendingRequests();
  Future<FriendRequestItem> sendRequest(String receiverUsername);
  Future<FriendRequestItem> acceptRequest(String requestId);
}
