import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/admin/domain/admin_models.dart';

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  return AdminRepository(dio: ref.watch(dioProvider));
});

final adminStatsProvider = FutureProvider.autoDispose<AdminStats>((ref) {
  return ref.watch(adminRepositoryProvider).getStats();
});

final adminUsersProvider = FutureProvider.autoDispose
    .family<AdminUserPage, int>((ref, page) {
      return ref.watch(adminRepositoryProvider).listUsers(page: page);
    });

class AdminRepository {
  const AdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<AdminStats> getStats() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/admin/stats');
    return AdminStats.fromJson(response.data!);
  }

  Future<AdminUserPage> listUsers({required int page}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/admin/users',
      queryParameters: {'page': page, 'size': 20},
    );
    return AdminUserPage.fromJson(response.data!);
  }

  Future<void> adjustCredits({
    required String userId,
    required int delta,
  }) async {
    await _dio.patch<void>(
      '/api/admin/users/$userId/credits',
      queryParameters: {'delta': delta},
    );
  }
}
