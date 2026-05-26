import 'package:tonebridge/features/auth/domain/model/user.dart';

/// Port (hexagonal architecture) — the auth feature depends on this
/// abstraction, not on the concrete HTTP implementation.
abstract interface class AuthRepository {
  /// Signs in with Google.
  /// - Web: uses Firebase Auth popup; falls back to redirect for PWA standalone mode.
  /// - Native: uses the Google Sign-In SDK.
  /// Returns null if the user cancelled or a redirect was initiated (result
  /// will arrive via [handleRedirectResult] on the next app load).
  Future<AuthSession?> signInWithGoogle();

  /// Completes a Google sign-in that was started via a redirect flow.
  /// Must be called on every app start on web; returns null on native or
  /// when there is no pending redirect result.
  Future<AuthSession?> handleRedirectResult();

  /// Fetches the currently authenticated user's profile.
  Future<User> getCurrentUser();

  /// Refreshes a persisted mobile session using the secure refresh token.
  Future<AuthSession?> restoreSession();

  /// Saves the user's language preferences during onboarding.
  /// [username] is optional — if provided, the server will update the nickname too.
  Future<void> saveLanguagePreferences({
    required String nativeLanguage,
    required List<String> fluentLanguages,
    required List<String> learningLanguages,
    String? username,
    String? nativeDialect,
    Map<String, String> fluentLanguageVariants = const {},
    Map<String, String> learningLanguageVariants = const {},
  });

  /// Revokes all tokens and clears local storage.
  Future<void> signOut();

  /// Permanently deletes the current user's account and clears local storage.
  Future<void> deleteAccount();
}
