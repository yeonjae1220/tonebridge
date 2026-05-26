import 'package:tonebridge/features/auth/domain/model/user.dart';

abstract interface class AuthRepository {
  /// Signs in with Google.
  /// - Web: navigates the browser to the backend OAuth initiation endpoint;
  ///   the result arrives on the next app load via cookie-based session restore.
  /// - Native: uses the Google Sign-In SDK and exchanges the idToken with the backend.
  /// Returns null if the user cancelled or a browser navigation was initiated.
  Future<AuthSession?> signInWithGoogle();

  /// Fetches the currently authenticated user's profile.
  Future<User> getCurrentUser();

  /// Restores a persisted session.
  /// - Web: calls POST /api/auth/refresh with the HttpOnly refresh-token cookie.
  /// - Native: uses the secure refresh token from local storage.
  Future<AuthSession?> restoreSession();

  /// Saves the user's language preferences during onboarding.
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
