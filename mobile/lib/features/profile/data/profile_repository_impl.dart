import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/profile/domain/model/user_profile.dart';
import 'package:tonebridge/features/profile/domain/profile_repository.dart';

part 'profile_repository_impl.g.dart';

@riverpod
ProfileRepository profileRepository(Ref ref) =>
    ProfileRepositoryImpl(dio: ref.watch(dioProvider));

class ProfileRepositoryImpl implements ProfileRepository {
  const ProfileRepositoryImpl({required Dio dio}) : _dio = dio;
  final Dio _dio;

  @override
  Future<UserProfile> getProfile() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/api/users/me/profile');
    return UserProfile.fromJson(response.data!);
  }
}
