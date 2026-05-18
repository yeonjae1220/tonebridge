import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Keys used for secure storage. Centralised to avoid typos.
abstract final class StorageKey {
  static const String accessToken = 'access_token';
  static const String refreshToken = 'refresh_token';
  static const String userId = 'user_id';
  static const String userEmail = 'user_email';
}

/// Thin wrapper around [FlutterSecureStorage].
///
/// Mobile stores both access and refresh tokens in platform secure storage.
/// The web client still uses the backend-managed httpOnly refresh cookie.
class SecureStorageService {
  const SecureStorageService(this._storage);

  final FlutterSecureStorage _storage;

  Future<void> saveAccessToken(String token) =>
      _storage.write(key: StorageKey.accessToken, value: token);

  Future<String?> readAccessToken() =>
      _storage.read(key: StorageKey.accessToken);

  Future<void> saveRefreshToken(String token) =>
      _storage.write(key: StorageKey.refreshToken, value: token);

  Future<String?> readRefreshToken() =>
      _storage.read(key: StorageKey.refreshToken);

  Future<void> saveUserId(String id) =>
      _storage.write(key: StorageKey.userId, value: id);

  Future<String?> readUserId() => _storage.read(key: StorageKey.userId);

  Future<void> saveUserEmail(String email) =>
      _storage.write(key: StorageKey.userEmail, value: email);

  Future<String?> readUserEmail() => _storage.read(key: StorageKey.userEmail);

  Future<void> clearAll() => _storage.deleteAll();
}
