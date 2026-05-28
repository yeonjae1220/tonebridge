import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/config/app_config.dart';
import 'package:tonebridge/core/platform/google_id_token.dart'
    if (dart.library.html) 'package:tonebridge/core/platform/google_id_token_web.dart';
import 'package:tonebridge/core/platform/web_redirect.dart'
    if (dart.library.html) 'package:tonebridge/core/platform/web_redirect_web.dart';
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
  }) : _dio = dio,
       _storage = storage;

  final Dio _dio;
  final SecureStorageService _storage;

  // ── Google Sign-In ────────────────────────────────────────────────────────

  @override
  Future<AuthSession?> signInWithGoogle() async {
    if (kIsWeb) return _signInWithGoogleWeb();
    return _signInWithGoogleNative();
  }

  /// Web: navigates the browser to the backend OAuth endpoint.
  /// The backend performs the OAuth flow server-side and redirects back to
  /// /auth/callback with the access token in the URL fragment and sets an
  /// HttpOnly refresh_token cookie.  The app restores the session on the
  /// next load via [_restoreSessionWeb].
  Future<AuthSession?> _signInWithGoogleWeb() async {
    navigateTo('${AppConfig.baseUrl}/api/auth/google');
    return null;
  }

  /// Native: google_sign_in SDK → exchange idToken with backend.
  Future<AuthSession?> _signInWithGoogleNative() async {
    assert(
      AppConfig.googleClientId.isNotEmpty,
      'GOOGLE_CLIENT_ID is not set. '
      'Pass it via --dart-define=GOOGLE_CLIENT_ID=<web-client-id>',
    );

    final idToken = await requestGoogleIdToken(
      serverClientId: AppConfig.googleClientId,
    );
    if (idToken == null) return null;

    final response = await _dio.post<Map<String, dynamic>>(
      '/api/auth/mobile/google/id-token',
      data: {'idToken': idToken},
    );
    return _saveSession(TokenResponse.fromJson(response.data!));
  }

  // ── Session ───────────────────────────────────────────────────────────────

  @override
  Future<AuthSession?> restoreSession() async {
    if (kIsWeb) return _restoreSessionWeb();
    return _restoreSessionNative();
  }

  /// Web: POST /api/auth/refresh — the browser sends the HttpOnly cookie automatically.
  Future<AuthSession?> _restoreSessionWeb() async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/api/auth/refresh',
      );
      final accessToken = response.data?['accessToken'] as String?;
      if (accessToken == null) return null;

      await _storage.saveAccessToken(accessToken);
      final user = await getCurrentUser();
      return AuthSession(
        user: user,
        accessToken: accessToken,
        needsOnboarding: user.nativeLanguage.isEmpty,
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return null;
      rethrow;
    }
  }

  /// Native: stored refresh token → POST /api/auth/mobile/refresh.
  Future<AuthSession?> _restoreSessionNative() async {
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

  // ── User ──────────────────────────────────────────────────────────────────

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
        uiLanguage: parsed.uiLanguage,
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
      uiLanguage: d.uiLanguage,
      fluentLanguages: d.fluentLanguages,
      learningLanguages: d.learningLanguages,
      credits: d.credits,
      reputationScore: d.reputationScore,
      nativeDialect: d.nativeDialect,
      fluentLanguageVariants: d.fluentLanguageVariants,
      learningLanguageVariants: d.learningLanguageVariants,
    );
  }

  // ── Preferences / Lifecycle ───────────────────────────────────────────────

  @override
  Future<void> saveLanguagePreferences({
    required String nativeLanguage,
    required String uiLanguage,
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
        'uiLanguage': uiLanguage,
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
      if (kIsWeb) {
        await _dio.post<void>('/api/auth/logout');
      } else {
        final refreshToken = await _storage.readRefreshToken();
        if (refreshToken != null) {
          await _dio.post<void>(
            '/api/auth/mobile/logout',
            data: {'refreshToken': refreshToken},
          );
        }
      }
    } finally {
      await _storage.clearAll();
    }
  }

  @override
  Future<void> deleteAccount() async {
    try {
      await _dio.delete<void>('/api/users/me');
      if (kIsWeb) {
        await _dio.post<void>('/api/auth/logout');
      }
    } finally {
      await _storage.clearAll();
    }
  }
}
