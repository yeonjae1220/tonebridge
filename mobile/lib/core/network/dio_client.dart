import 'package:dio/dio.dart';
import 'package:tonebridge/core/config/app_config.dart';
import 'package:tonebridge/core/network/auth_interceptor.dart';
import 'package:tonebridge/core/network/dio_web_adapter.dart'
    if (dart.library.html) 'package:tonebridge/core/network/dio_web_adapter_web.dart';

/// Factory that produces the shared [Dio] instance.
///
/// - Base URL and timeouts come from [AppConfig] (compile-time env vars).
/// - [AuthInterceptor] attaches the Bearer token and handles 401 refresh.
Dio createDio(AuthInterceptor authInterceptor) {
  final dio = createUnauthenticatedDio();

  dio.interceptors.addAll([
    authInterceptor,
    LogInterceptor(
      logPrint: (_) {}, // replace with a real logger in production
    ),
  ]);

  return dio;
}

Dio createUnauthenticatedDio() {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.baseUrl,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      headers: const {'Accept': 'application/json'},
    ),
  );
  configurePlatformDio(dio);
  return dio;
}
