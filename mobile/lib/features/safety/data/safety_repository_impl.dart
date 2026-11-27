import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/safety/domain/safety_repository.dart';

final safetyRepositoryProvider = Provider<SafetyRepository>(
  (ref) => SafetyRepositoryImpl(dio: ref.watch(dioProvider)),
);

class SafetyRepositoryImpl implements SafetyRepository {
  const SafetyRepositoryImpl({required Dio dio}) : _dio = dio;
  final Dio _dio;

  static const _blocks = '/api/users/me/blocks';

  @override
  Future<String> report({
    required ReportTarget target,
    required String targetId,
    required ReportReason reason,
    String? detail,
    bool alsoBlock = false,
  }) async {
    final trimmed = detail?.trim();
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/reports',
      data: {
        'targetType': target.apiName,
        'targetId': targetId,
        'reason': reason.apiName,
        if (trimmed != null && trimmed.isNotEmpty) 'detail': trimmed,
        'alsoBlock': alsoBlock,
      },
    );
    final id = response.data?['id'];
    if (id is! String) {
      throw StateError('Unexpected body from POST /api/reports');
    }
    return id;
  }

  @override
  Future<void> block(String userId) => _dio.put<void>('$_blocks/$userId');

  @override
  Future<void> unblock(String userId) => _dio.delete<void>('$_blocks/$userId');

  @override
  Future<BlockedUsersResult> blockedUsers({int page = 0}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      _blocks,
      queryParameters: {'page': page},
    );
    final data = response.data;
    final items = data?['items'];
    if (items is! List) {
      // An empty list here would read as "nobody blocked" (GLOBAL-PIT-108).
      throw StateError('Unexpected body from GET $_blocks');
    }
    return BlockedUsersResult(
      items: items
          .map((e) => BlockedUser.fromJson(e as Map<String, dynamic>))
          .toList(),
      nextPage: data?['nextPage'] as int?,
    );
  }
}
