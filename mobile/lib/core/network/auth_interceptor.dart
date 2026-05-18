import 'dart:async';

import 'package:dio/dio.dart';
import 'package:tonebridge/core/storage/secure_storage_service.dart';

/// Intercepts every request to attach the Bearer access token.
/// On 401, attempts a token refresh via `/api/auth/refresh` and
/// retries the original request exactly once.
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

    // Skip refresh loop for the refresh endpoint itself.
    if (err.requestOptions.path.contains('/api/auth/mobile/refresh')) {
      handler.next(err);
      return;
    }

    if (_isRefreshing) {
      // Queue request until ongoing refresh finishes.
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
      final refreshToken = await _storage.readRefreshToken();
      if (refreshToken == null) {
        throw DioException(requestOptions: err.requestOptions);
      }

      final refreshResponse = await refreshDio.post<Map<String, dynamic>>(
        '/api/auth/mobile/refresh',
        data: {'refreshToken': refreshToken},
      );

      final newToken = refreshResponse.data?['accessToken'] as String?;
      final newRefreshToken = refreshResponse.data?['refreshToken'] as String?;
      if (newToken == null || newRefreshToken == null) {
        throw DioException(requestOptions: err.requestOptions);
      }

      await _storage.saveAccessToken(newToken);
      await _storage.saveRefreshToken(newRefreshToken);

      // Replay queued requests with new token.
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

      // Retry the original request.
      err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
      final retryDio = _refreshDioFactory();
      final retryResponse = await retryDio.fetch<dynamic>(err.requestOptions);
      _isRefreshing = false;
      handler.resolve(retryResponse);
    } catch (refreshError) {
      // Snapshot and clear the queue BEFORE awaiting clearAll so any requests
      // that arrive during clearAll() don't get stuck in an orphaned Completer.
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
