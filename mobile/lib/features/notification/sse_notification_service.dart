import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/config/app_config.dart';
import 'package:tonebridge/core/storage/secure_storage_service.dart';
import 'package:tonebridge/core/providers/core_providers.dart';

part 'sse_notification_service.g.dart';

/// Represents an event received from the Spring Boot SseEmitter.
class SseEvent {
  const SseEvent({required this.type, required this.data});

  final String type;
  final Map<String, dynamic> data;
}

/// Connects to `GET /api/sse/notifications` and yields [SseEvent]s.
///
/// Uses the `http` package stream — the access token is sent as a
/// query parameter because SSE EventSource does not support custom
/// headers on all platforms.
///
/// Reconnects automatically on error with exponential back-off.
class SseNotificationService {
  SseNotificationService(this._storage);

  final SecureStorageService _storage;

  StreamController<SseEvent>? _controller;
  http.Client? _client;
  Timer? _reconnectTimer;
  int _reconnectDelay = 2;
  bool _isDisposed = false;

  Stream<SseEvent> get stream {
    _controller ??= StreamController<SseEvent>.broadcast(
      onListen: _connect,
      onCancel: dispose,
    );
    return _controller!.stream;
  }

  Future<void> _connect() async {
    if (_isDisposed) return;
    final token = await _storage.readAccessToken();
    if (token == null) return;

    // Token is sent in the Authorization header — NOT as a query param
    // to prevent accidental logging in proxies / server access logs.
    final uri = Uri.parse('${AppConfig.baseUrl}/api/sse/notifications');

    _client = http.Client();
    try {
      final request = http.Request('GET', uri)
        ..headers['Authorization'] = 'Bearer $token'
        ..headers['Accept'] = 'text/event-stream'
        ..headers['Cache-Control'] = 'no-cache';
      final response = await _client!.send(request);

      if (response.statusCode != 200) {
        _scheduleReconnect();
        return;
      }

      _reconnectDelay = 2; // reset on success

      response.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen(
            _parseLine,
            onError: (_) => _scheduleReconnect(),
            onDone: _scheduleReconnect,
          );
    } catch (e) {
      debugPrint('[SSE] Connection error: $e');
      _scheduleReconnect();
    }
  }

  String _eventType = 'message';
  final StringBuffer _dataBuffer = StringBuffer();

  void _parseLine(String line) {
    if (line.startsWith('event:')) {
      _eventType = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      _dataBuffer.write(line.substring(5).trim());
    } else if (line.isEmpty) {
      // Blank line signals end of event.
      final raw = _dataBuffer.toString();
      _dataBuffer.clear();
      if (raw.isEmpty) return;
      try {
        final json = jsonDecode(raw) as Map<String, dynamic>;
        _controller?.add(SseEvent(type: _eventType, data: json));
      } catch (e) {
        debugPrint('[SSE] Parse error: $e');
      }
      _eventType = 'message';
    }
  }

  void _scheduleReconnect() {
    _client?.close();
    _reconnectTimer?.cancel();
    if (_isDisposed) return; // Don't reconnect after dispose
    _reconnectTimer = Timer(Duration(seconds: _reconnectDelay), _connect);
    _reconnectDelay = (_reconnectDelay * 2).clamp(2, 30);
  }

  void dispose() {
    _isDisposed = true;
    _reconnectTimer?.cancel();
    _client?.close();
    _controller?.close();
    _controller = null;
  }
}

@Riverpod(keepAlive: true)
SseNotificationService sseNotificationService(Ref ref) {
  final service = SseNotificationService(ref.watch(secureStorageServiceProvider));
  ref.onDispose(service.dispose);
  return service;
}
