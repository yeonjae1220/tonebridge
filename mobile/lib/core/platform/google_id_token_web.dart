Future<String?> requestGoogleIdToken({required String serverClientId}) {
  throw UnsupportedError(
    'Google Sign-In SDK authentication is not supported on web. '
    'Use the backend OAuth redirect flow instead.',
  );
}
