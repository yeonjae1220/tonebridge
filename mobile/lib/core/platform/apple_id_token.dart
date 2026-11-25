import 'package:sign_in_with_apple/sign_in_with_apple.dart';

/// Runs Sign in with Apple and returns the identity token (a JWT the backend verifies),
/// or null if the user cancelled. Only the email scope is requested — the app never uses the name.
Future<String?> requestAppleIdentityToken() async {
  try {
    final credential = await SignInWithApple.getAppleIDCredential(
      scopes: const [AppleIDAuthorizationScopes.email],
    );
    final token = credential.identityToken;
    if (token == null) {
      throw StateError('Sign in with Apple returned no identity token');
    }
    return token;
  } on SignInWithAppleAuthorizationException catch (e) {
    if (e.code == AuthorizationErrorCode.canceled) return null;
    rethrow;
  }
}
