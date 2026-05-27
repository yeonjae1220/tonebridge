import 'package:google_sign_in/google_sign_in.dart';

Future<void>? _initializeFuture;
String? _initializedServerClientId;

Future<String?> requestGoogleIdToken({required String serverClientId}) async {
  await _ensureInitialized(serverClientId);

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
    final idToken = account.authentication.idToken;
    if (idToken == null) {
      throw Exception('Google idToken을 받을 수 없습니다. serverClientId 설정을 확인하세요.');
    }
    return idToken;
  } finally {
    try {
      await GoogleSignIn.instance.signOut();
    } catch (_) {}
  }
}

Future<void> _ensureInitialized(String serverClientId) {
  final existing = _initializeFuture;
  if (existing != null) {
    if (_initializedServerClientId != serverClientId) {
      throw StateError(
        'Google Sign-In was initialized with a different client ID.',
      );
    }
    return existing;
  }

  _initializedServerClientId = serverClientId;
  return _initializeFuture = GoogleSignIn.instance.initialize(
    serverClientId: serverClientId,
  );
}
