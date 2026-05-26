import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/auth/data/auth_repository_impl.dart';
import 'package:tonebridge/features/auth/domain/model/user.dart';

part 'auth_provider.g.dart';

/// Watches the current [AuthSession]. Kept alive for the app's lifetime.
/// Returns `null` when not logged in, throws on unrecoverable errors.
@Riverpod(keepAlive: true)
class AuthState extends _$AuthState {
  @override
  Future<AuthSession?> build() async {
    // 웹: Google redirect 로그인 후 앱 재로드 시 결과를 처리한다.
    // getRedirectResult()는 결과가 없으면 즉시 null을 반환하므로 오버헤드 없음.
    if (kIsWeb) {
      final repo = ref.read(authRepositoryProvider);
      final redirectSession = await repo.handleRedirectResult();
      if (redirectSession != null) return redirectSession;
    }

    // Attempt to restore a previous session from secure storage.
    final storage = ref.watch(secureStorageServiceProvider);
    final token = await storage.readAccessToken();
    if (token == null) {
      final repo = ref.read(authRepositoryProvider);
      return repo.restoreSession();
    }

    // Token exists — validate by fetching the current user.
    try {
      final repo = ref.read(authRepositoryProvider);
      final user = await repo.getCurrentUser();
      final currentToken = await storage.readAccessToken() ?? token;
      return AuthSession(
        user: user,
        accessToken: currentToken,
        needsOnboarding: user.nativeLanguage.isEmpty,
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        await storage.clearAll();
        return null;
      }
      rethrow;
    } catch (_) {
      await storage.clearAll();
      return null;
    }
  }

  /// Signs in with Google via the native SDK and stores the resulting session.
  Future<void> signInWithGoogle() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(authRepositoryProvider);
      return repo.signInWithGoogle();
    });
  }

  Future<void> signOut() async {
    state = const AsyncLoading();
    try {
      final repo = ref.read(authRepositoryProvider);
      await repo.signOut();
    } catch (_) {
      // Server-side revocation may fail (e.g. network error), but local
      // storage is cleared in the repository's finally block regardless.
    } finally {
      state = const AsyncData(null);
    }
  }

  Future<void> deleteAccount() async {
    state = const AsyncLoading();
    try {
      final repo = ref.read(authRepositoryProvider);
      await repo.deleteAccount();
      state = const AsyncData(null);
    } catch (e, st) {
      // Restore previous state so the caller can show an error and retry.
      state = AsyncError(e, st);
      rethrow;
    }
  }

  Future<void> completeOnboarding({
    required String nativeLanguage,
    required List<String> fluentLanguages,
    required List<String> learningLanguages,
    String? username,
    String? nativeDialect,
    Map<String, String> fluentLanguageVariants = const {},
    Map<String, String> learningLanguageVariants = const {},
  }) async {
    final repo = ref.read(authRepositoryProvider);
    await repo.saveLanguagePreferences(
      nativeLanguage: nativeLanguage,
      fluentLanguages: fluentLanguages,
      learningLanguages: learningLanguages,
      username: username,
      nativeDialect: nativeDialect,
      fluentLanguageVariants: fluentLanguageVariants,
      learningLanguageVariants: learningLanguageVariants,
    );
    final currentSession = state.value;
    if (currentSession == null) return;
    // Re-fetch the user so the in-memory session reflects the new language
    // fields immediately, rather than keeping them stale until the next cold start.
    final updatedUser = await repo.getCurrentUser();
    state = AsyncData(currentSession.copyWith(
      user: updatedUser,
      needsOnboarding: false,
    ));
  }
}
