import 'dart:developer' as dev;

import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/friend/domain/friend_repository.dart';
import 'package:tonebridge/features/friend/domain/model/friend.dart';
import 'package:tonebridge/features/friend/domain/model/user_search_result.dart';

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
    final data = response.data;
    if (data == null) {
      dev.log('Unexpected null body from GET /api/friends', name: 'FriendRepository');
      return [];
    }
    return data.map((e) => Friend.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<List<FriendRequestItem>> getPendingRequests() async {
    final response = await _dio.get<List<dynamic>>('/api/friends/pending');
    final data = response.data;
    if (data == null) {
      dev.log('Unexpected null body from GET /api/friends/pending', name: 'FriendRepository');
      return [];
    }
    return data
        .map((e) => FriendRequestItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<UserSearchResult>> searchUsers(String query) async {
    final response = await _dio.get<List<dynamic>>(
      '/api/users/search',
      queryParameters: {'q': query, 'limit': 10},
    );
    final data = response.data;
    if (data == null) {
      dev.log('Unexpected null body from GET /api/users/search', name: 'FriendRepository');
      return [];
    }
    return data
        .map((e) => UserSearchResult.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<FriendRequestItem> sendRequest(String receiverUsername) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/friends/request',
      data: {'receiverUsername': receiverUsername},
    );
    final data = response.data;
    if (data == null) throw Exception('서버 응답 오류');
    return FriendRequestItem.fromJson(data);
  }

  @override
  Future<FriendRequestItem> acceptRequest(String requestId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/friends/$requestId/accept',
    );
    final data = response.data;
    if (data == null) throw Exception('서버 응답 오류');
    return FriendRequestItem.fromJson(data);
  }

  @override
  Future<void> declineRequest(String requestId) async {
    await _dio.delete<void>('/api/friends/requests/$requestId');
  }

  @override
  Future<void> removeFriend(String friendId) async {
    await _dio.delete<void>('/api/friends/$friendId');
  }
}
