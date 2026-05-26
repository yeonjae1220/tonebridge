import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:tonebridge/core/storage/secure_storage_service.dart';

/// Intercepts every request to attach the Bearer access token.
/// On 401, attempts a token refresh and retries the original request once.
///
/// Web: refreshes via POST /api/auth/refresh (HttpOnly cookie, no body).
/// Native: refreshes via POST /api/auth/mobile/refresh (stored refresh token).
///
/// Parallel 401 responses are queued and replayed after the single
/// refresh completes — preventing duplicate refresh calls.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required SecureStorageService storage,
    required Dio Function() refreshDioFactory,
  })  : _storage = storage,
        _refreshDioFactory = refreshDioFactory;

  final SecureStorageService _storage;
  final Dio Function() _refreshDioFactory;

  bool _isRefreshing = false;
  final List<_PendingRequest> _queue = [];

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.readAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    final path = err.requestOptions.path;
    if (path.contains('/api/auth/mobile/refresh') ||
        path.contains('/api/auth/refresh')) {
      handler.next(err);
      return;
    }

    if (_isRefreshing) {
      final completer = _PendingRequest(err.requestOptions);
      _queue.add(completer);
      try {
        final response = await completer.future;
        handler.resolve(response);
      } catch (e) {
        handler.next(err);
      }
      return;
    }

    _isRefreshing = true;
    try {
      final refreshDio = _refreshDioFactory();
      final String newToken;

      if (kIsWeb) {
        // Cookie-based refresh — browser sends HttpOnly cookie automatically.
        final refreshResponse = await refreshDio.post<Map<String, dynamic>>(
          '/api/auth/refresh',
        );
        final token = refreshResponse.data?['accessToken'] as String?;
        if (token == null) {
          throw DioException(requestOptions: err.requestOptions);
        }
        newToken = token;
        await _storage.saveAccessToken(newToken);
      } else {
        final refreshToken = await _storage.readRefreshToken();
        if (refreshToken == null) {
          throw DioException(requestOptions: err.requestOptions);
        }

        final refreshResponse = await refreshDio.post<Map<String, dynamic>>(
          '/api/auth/mobile/refresh',
          data: {'refreshToken': refreshToken},
        );

        final token = refreshResponse.data?['accessToken'] as String?;
        final newRefreshToken =
            refreshResponse.data?['refreshToken'] as String?;
        if (token == null || newRefreshToken == null) {
          throw DioException(requestOptions: err.requestOptions);
        }
        newToken = token;
        await _storage.saveAccessToken(newToken);
        await _storage.saveRefreshToken(newRefreshToken);
      }

      for (final pending in _queue) {
        pending.requestOptions.headers['Authorization'] = 'Bearer $newToken';
        try {
          final retryDio = _refreshDioFactory();
          final res = await retryDio.fetch<dynamic>(pending.requestOptions);
          pending.complete(res);
        } catch (e) {
          pending.completeError(e);
        }
      }
      _queue.clear();

      err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
      final retryDio = _refreshDioFactory();
      final retryResponse = await retryDio.fetch<dynamic>(err.requestOptions);
      _isRefreshing = false;
      handler.resolve(retryResponse);
    } catch (refreshError) {
      final snapshot = List<_PendingRequest>.from(_queue);
      _queue.clear();
      _isRefreshing = false;

      for (final pending in snapshot) {
        pending.completeError(refreshError);
      }

      await _storage.clearAll();
      handler.next(err);
    }
  }
}

class _PendingRequest {
  _PendingRequest(this.requestOptions) {
    future = _completer.future;
    complete = _completer.complete;
    completeError = _completer.completeError;
  }

  final RequestOptions requestOptions;
  final _completer = Completer<Response<dynamic>>();

  late final Future<Response<dynamic>> future;
  late final void Function(Response<dynamic>) complete;
  late final void Function(Object) completeError;
}
