import 'package:tonebridge/features/auth/domain/model/user.dart';

/// Port (hexagonal architecture) — the auth feature depends on this
/// abstraction, not on the concrete HTTP implementation.
abstract interface class AuthRepository {
  /// Signs in with Google using the Google Sign-In SDK.
  /// Returns null if the user cancelled the sign-in flow.
  Future<AuthSession?> signInWithGoogle();

  /// Fetches the currently authenticated user's profile.
  Future<User> getCurrentUser();

  /// Refreshes a persisted mobile session using the secure refresh token.
  Future<AuthSession?> restoreSession();

  /// Saves the user's language preferences during onboarding.
  Future<void> saveLanguagePreferences({
    required String nativeLanguage,
    required List<String> fluentLanguages,
    required List<String> learningLanguages,
    String? nativeDialect,
    Map<String, String> fluentLanguageVariants,
    Map<String, String> learningLanguageVariants,
  });

  /// Revokes all tokens and clears local storage.
  Future<void> signOut();
}
