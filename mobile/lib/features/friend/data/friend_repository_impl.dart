import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/friend/domain/friend_repository.dart';
import 'package:tonebridge/features/friend/domain/model/friend.dart';

part 'friend_repository_impl.g.dart';

@riverpod
FriendRepository friendRepository(Ref ref) =>
    FriendRepositoryImpl(dio: ref.watch(dioProvider));

class FriendRepositoryImpl implements FriendRepository {
  const FriendRepositoryImpl({required Dio dio}) : _dio = dio;
  final Dio _dio;

  @override
  Future<List<Friend>> getFriends() async {
    final response = await _dio.get<List<dynamic>>('/api/friends');
    return response.data!
        .map((e) => Friend.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<FriendRequestItem>> getPendingRequests() async {
    final response = await _dio.get<List<dynamic>>('/api/friends/pending');
    return response.data!
        .map((e) => FriendRequestItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<FriendRequestItem> sendRequest(String receiverUsername) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/friends/request',
      data: {'receiverUsername': receiverUsername},
    );
    return FriendRequestItem.fromJson(response.data!);
  }

  @override
  Future<FriendRequestItem> acceptRequest(String requestId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/friends/$requestId/accept',
    );
    return FriendRequestItem.fromJson(response.data!);
  }
}
