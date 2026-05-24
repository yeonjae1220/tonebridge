import 'package:dio/dio.dart';
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

  Future<void> completeOnboarding({
    required String nativeLanguage,
    required List<String> fluentLanguages,
    required List<String> learningLanguages,
    String? nativeDialect,
    Map<String, String> fluentLanguageVariants = const {},
    Map<String, String> learningLanguageVariants = const {},
  }) async {
    final repo = ref.read(authRepositoryProvider);
    await repo.saveLanguagePreferences(
      nativeLanguage: nativeLanguage,
      fluentLanguages: fluentLanguages,
      learningLanguages: learningLanguages,
      nativeDialect: nativeDialect,
      fluentLanguageVariants: fluentLanguageVariants,
      learningLanguageVariants: learningLanguageVariants,
    );
    final currentSession = state.value;
    if (currentSession != null) {
      state = AsyncData(currentSession.copyWith(needsOnboarding: false));
    }
  }
}
