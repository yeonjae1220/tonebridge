import 'package:dio/dio.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/config/app_config.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/core/storage/secure_storage_service.dart';
import 'package:tonebridge/features/auth/data/dto/auth_response.dart';
import 'package:tonebridge/features/auth/domain/auth_repository.dart';
import 'package:tonebridge/features/auth/domain/model/user.dart';

part 'auth_repository_impl.g.dart';

@Riverpod(keepAlive: true)
AuthRepository authRepository(Ref ref) {
  return AuthRepositoryImpl(
    dio: ref.watch(dioProvider),
    storage: ref.watch(secureStorageServiceProvider),
  );
}

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl({
    required Dio dio,
    required SecureStorageService storage,
  })  : _dio = dio,
        _storage = storage;

  final Dio _dio;
  final SecureStorageService _storage;

  @override
  Future<AuthSession?> signInWithGoogle() async {
    // serverClientId must be the "Web application" OAuth 2.0 Client ID from
    // Google Cloud Console — NOT the Android/iOS client ID.
    // A missing value causes idToken to be null at runtime.
    assert(
      AppConfig.googleClientId.isNotEmpty,
      'GOOGLE_CLIENT_ID is not set. Pass it via --dart-define=GOOGLE_CLIENT_ID=<web-client-id>',
    );

    await GoogleSignIn.instance.initialize(
      serverClientId: AppConfig.googleClientId,
    );

    final GoogleSignInAccount account;
    try {
      account = await GoogleSignIn.instance.authenticate(
        scopeHint: ['email', 'profile', 'openid'],
      );
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) return null;
      rethrow;
    }

    try {
      final auth = account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) {
        throw Exception('Google idToken을 받을 수 없습니다. serverClientId 설정을 확인하세요.');
      }

      final response = await _dio.post<Map<String, dynamic>>(
        '/api/auth/mobile/google/id-token',
        data: {'idToken': idToken},
      );
      return _saveSession(TokenResponse.fromJson(response.data!));
    } finally {
      // Don't cache the Google account state — each login should be explicit.
      // Swallow signOut errors so the original exception (if any) propagates.
      try {
        await GoogleSignIn.instance.signOut();
      } catch (_) {}
    }
  }

  @override
  Future<AuthSession?> restoreSession() async {
    final refreshToken = await _storage.readRefreshToken();
    if (refreshToken == null) return null;

    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/api/auth/mobile/refresh',
        data: {'refreshToken': refreshToken},
      );
      return _saveSession(TokenResponse.fromJson(response.data!));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        await _storage.clearAll();
        return null;
      }
      rethrow;
    }
  }

  Future<AuthSession> _saveSession(TokenResponse parsed) async {
    final token = parsed.accessToken;
    await _storage.saveAccessToken(token);
    await _storage.saveRefreshToken(parsed.refreshToken);

    final user = _toUser(parsed.user);
    await _storage.saveUserId(user.id);
    await _storage.saveUserEmail(user.email);

    return AuthSession(
      user: user,
      accessToken: token,
      needsOnboarding: parsed.needsOnboarding,
    );
  }

  @override
  Future<User> getCurrentUser() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/users/me');
    final parsed = UserResponse.fromJson(response.data!);
    return _toUser(
      UserData(
        id: parsed.id,
        email: parsed.email,
        username: parsed.username,
        nativeLanguage: parsed.nativeLanguage,
        fluentLanguages: parsed.fluentLanguages,
        learningLanguages: parsed.learningLanguages,
        credits: parsed.credits,
        reputationScore: parsed.reputationScore,
        onboardingCompleted: parsed.onboardingCompleted,
        nativeDialect: parsed.nativeDialect,
        fluentLanguageVariants: parsed.fluentLanguageVariants,
        learningLanguageVariants: parsed.learningLanguageVariants,
      ),
    );
  }

  User _toUser(UserData d) {
    return User(
      id: d.id,
      email: d.email,
      username: d.username,
      nativeLanguage: d.nativeLanguage,
      fluentLanguages: d.fluentLanguages,
      learningLanguages: d.learningLanguages,
      credits: d.credits,
      reputationScore: d.reputationScore,
      nativeDialect: d.nativeDialect,
      fluentLanguageVariants: d.fluentLanguageVariants,
      learningLanguageVariants: d.learningLanguageVariants,
    );
  }

  @override
  Future<void> saveLanguagePreferences({
    required String nativeLanguage,
    required List<String> fluentLanguages,
    required List<String> learningLanguages,
    String? username,
    String? nativeDialect,
    Map<String, String> fluentLanguageVariants = const {},
    Map<String, String> learningLanguageVariants = const {},
  }) async {
    await _dio.patch<void>(
      '/api/users/me/onboarding',
      data: {
        if (username != null && username.isNotEmpty) 'username': username,
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

  @override
  Future<void> signOut() async {
    try {
      final refreshToken = await _storage.readRefreshToken();
      if (refreshToken != null) {
        await _dio.post<void>(
          '/api/auth/mobile/logout',
          data: {'refreshToken': refreshToken},
        );
      }
    } finally {
      await _storage.clearAll();
    }
  }

  @override
  Future<void> deleteAccount() async {
    await _dio.delete<void>('/api/users/me');
    await _storage.clearAll();
  }
}
