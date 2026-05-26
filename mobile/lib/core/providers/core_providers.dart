import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/config/app_config.dart';
import 'package:tonebridge/core/network/auth_interceptor.dart';
import 'package:tonebridge/core/network/dio_client.dart';
import 'package:tonebridge/core/storage/secure_storage_service.dart';

part 'core_providers.g.dart';

@Riverpod(keepAlive: true)
FlutterSecureStorage flutterSecureStorage(Ref ref) {
  return const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    wOptions: WebOptions(
      dbName: 'tonebridge_secure',
      publicKey: 'tonebridge_key',
    ),
  );
}

@Riverpod(keepAlive: true)
SecureStorageService secureStorageService(Ref ref) {
  return SecureStorageService(ref.watch(flutterSecureStorageProvider));
}

@Riverpod(keepAlive: true)
AuthInterceptor authInterceptor(Ref ref) {
  final storage = ref.watch(secureStorageServiceProvider);
  // Use AppConfig.baseUrl directly — avoids reading dioProvider here
  // which would create a circular dependency (dio → interceptor → dio).
  return AuthInterceptor(
    storage: storage,
    refreshDioFactory: () => Dio()..options.baseUrl = AppConfig.baseUrl,
  );
}

@Riverpod(keepAlive: true)
Dio dio(Ref ref) {
  return createDio(ref.watch(authInterceptorProvider));
}
