import 'package:freezed_annotation/freezed_annotation.dart';

part 'friend.freezed.dart';
part 'friend.g.dart';

@freezed
abstract class Friend with _$Friend {
  const factory Friend({
    required String id,
    required String username,
    required String nativeLanguage,
  }) = _Friend;

  factory Friend.fromJson(Map<String, dynamic> json) => _$FriendFromJson(json);
}

@freezed
abstract class FriendRequestItem with _$FriendRequestItem {
  const factory FriendRequestItem({
    required String id,
    required String senderId,
    required String receiverId,
    required String status,
    required DateTime createdAt,
    @Default('') String senderUsername,
  }) = _FriendRequestItem;

  factory FriendRequestItem.fromJson(Map<String, dynamic> json) =>
      _$FriendRequestItemFromJson(json);
}
