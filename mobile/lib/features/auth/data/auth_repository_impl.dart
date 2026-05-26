import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/foundation.dart' show kIsWeb;
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

  // ── Google Sign-In ────────────────────────────────────────────────────────

  @override
  Future<AuthSession?> signInWithGoogle() async {
    if (kIsWeb) return _signInWithGoogleWeb();
    return _signInWithGoogleNative();
  }

  /// Web: Firebase Auth redirect — 팝업 차단·사용자 제스처 컨텍스트 소실·iOS Safari PWA
  /// 문제를 피하기 위해 항상 리다이렉트 방식을 사용한다.
  /// 인증 완료 후 앱이 재로드되면 handleRedirectResult()가 결과를 처리한다.
  Future<AuthSession?> _signInWithGoogleWeb() async {
    if (!AppConfig.firebaseConfigured) {
      throw Exception(
          'Firebase가 초기화되지 않았습니다. FIREBASE_CONFIGURED 환경변수를 확인하세요.');
    }

    final provider = fb.GoogleAuthProvider()
      ..addScope('email')
      ..addScope('profile');

    await fb.FirebaseAuth.instance.signInWithRedirect(provider);
    return null;
  }

  /// 리다이렉트 흐름 완료 처리 — 앱 재로드 후 [handleRedirectResult]에서 호출된다.
  Future<AuthSession?> _completeWebSignIn(
      fb.UserCredential credential) async {
    final googleCred = credential.credential as fb.OAuthCredential?;
    final idToken = googleCred?.idToken;
    if (idToken == null) {
      throw Exception(
          'Google idToken을 받을 수 없습니다. '
          'Firebase Console → Authentication → Sign-in providers에서 '
          'Google 로그인이 활성화되어 있는지 확인하세요.');
    }

    // 백엔드 자체 세션을 사용하므로 Firebase Auth 세션은 즉시 해제한다.
    try {
      await fb.FirebaseAuth.instance.signOut();
    } catch (_) {}

    final response = await _dio.post<Map<String, dynamic>>(
      '/api/auth/mobile/google/id-token',
      data: {'idToken': idToken},
    );
    return _saveSession(TokenResponse.fromJson(response.data!));
  }

  @override
  Future<AuthSession?> handleRedirectResult() async {
    if (!kIsWeb || !AppConfig.firebaseConfigured) return null;
    try {
      final result =
          await fb.FirebaseAuth.instance.getRedirectResult();
      if (result.credential == null) return null;
      return _completeWebSignIn(result);
    } on fb.FirebaseAuthException catch (e) {
      // 사용자 취소는 무시, 설정 오류(unauthorized-domain 등)는 상위로 전파
      if (e.code == 'user-cancelled' || e.code == 'popup-closed-by-user') {
        return null;
      }
      rethrow;
    }
  }

  /// Native: google_sign_in SDK → 백엔드에 idToken 전달.
  Future<AuthSession?> _signInWithGoogleNative() async {
    assert(
      AppConfig.googleClientId.isNotEmpty,
      'GOOGLE_CLIENT_ID is not set. '
      'Pass it via --dart-define=GOOGLE_CLIENT_ID=<web-client-id>',
    );

    await GoogleSignIn.instance.initialize(
      clientId: null,
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
        throw Exception(
            'Google idToken을 받을 수 없습니다. serverClientId 설정을 확인하세요.');
      }

      final response = await _dio.post<Map<String, dynamic>>(
        '/api/auth/mobile/google/id-token',
        data: {'idToken': idToken},
      );
      return _saveSession(TokenResponse.fromJson(response.data!));
    } finally {
      try {
        await GoogleSignIn.instance.signOut();
      } catch (_) {}
    }
  }

  // ── Session ───────────────────────────────────────────────────────────────

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

  // ── User ──────────────────────────────────────────────────────────────────

  @override
  Future<User> getCurrentUser() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/api/users/me');
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

  // ── Preferences / Lifecycle ───────────────────────────────────────────────

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
