/// Application configuration loaded from compile-time environment variables.
///
/// Pass values at build time:
///   flutter run --dart-define=BASE_URL=https://api.tonebridge.app
///   flutter run --dart-define=OAUTH_REDIRECT_URI=tonebridge://oauth/callback
class AppConfig {
  AppConfig._();

  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8080',
  );

  // Web OAuth 2.0 client ID — used as serverClientId for google_sign_in
  // to obtain an idToken verifiable by the backend.
  // Pass at build time: flutter run --dart-define=GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
  static const String googleClientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
    defaultValue: '',
  );

  static const Duration connectTimeout = Duration(seconds: 10);
  static const Duration receiveTimeout = Duration(seconds: 15);

  /// Credit costs (mirrors backend constants)
  static const int textRequestCost = 5;
  static const int audioRequestCost = 10;

  /// AI fallback window
  static const Duration aiFallbackWindow = Duration(hours: 48);
}
