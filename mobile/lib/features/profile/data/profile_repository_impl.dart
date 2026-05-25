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
    final data = response.data;
    if (data == null) throw StateError('Profile response contained no data');
    return UserProfile.fromJson(data);
  }

  @override
  Future<void> updateNickname(String username) async {
    await _dio.patch<void>(
      '/api/users/me/username',
      data: {'username': username},
    );
  }

  @override
  Future<void> updateLanguages({
    required String nativeLanguage,
    required List<String> fluentLanguages,
    required List<String> learningLanguages,
    String? nativeDialect,
    Map<String, String> fluentLanguageVariants = const {},
    Map<String, String> learningLanguageVariants = const {},
  }) async {
    await _dio.patch<void>(
      '/api/users/me/languages',
      data: {
        'nativeLanguage': nativeLanguage,
        'fluentLanguages': fluentLanguages,
        'learningLanguages': learningLanguages,
        if (nativeDialect != null) 'nativeDialect': nativeDialect,
        if (fluentLanguageVariants.isNotEmpty)
          'fluentLanguageVariants': fluentLanguageVariants,
        if (learningLanguageVariants.isNotEmpty)
          'learningLanguageVariants': learningLanguageVariants,
      },
    );
  }
}
