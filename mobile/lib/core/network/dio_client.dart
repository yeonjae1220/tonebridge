import 'package:dio/dio.dart';
import 'package:tonebridge/core/config/app_config.dart';
import 'package:tonebridge/core/network/auth_interceptor.dart';

/// Factory that produces the shared [Dio] instance.
///
/// - Base URL and timeouts come from [AppConfig] (compile-time env vars).
/// - [AuthInterceptor] attaches the Bearer token and handles 401 refresh.
Dio createDio(AuthInterceptor authInterceptor) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.baseUrl,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      headers: const {'Accept': 'application/json'},
      // Mobile auth stores refresh tokens in secure storage and refreshes via
      // JSON endpoints, so this client does not rely on browser cookies.
    ),
  );

  dio.interceptors.addAll([
    authInterceptor,
    LogInterceptor(
      requestBody: false,
      responseBody: false,
      logPrint: (o) => null, // replace with a real logger in production
    ),
  ]);

  return dio;
}
