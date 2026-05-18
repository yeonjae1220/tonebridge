import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/providers/core_providers.dart';

part 'notification_service.g.dart';

/// Top-level handler for background FCM messages.
/// Must be a top-level function (not a method) — Firebase requirement.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM] Background message: ${message.notification?.title}');
}

/// Manages Firebase Cloud Messaging lifecycle:
///   - Requests notification permission
///   - Registers the FCM token with the backend
///   - Listens for foreground messages and notification taps
class NotificationService {
  NotificationService(this._messaging, this._dio);

  final FirebaseMessaging _messaging;
  final Dio _dio;

  // Subscriptions stored so they can be cancelled on dispose.
  StreamSubscription<String>? _tokenRefreshSub;
  StreamSubscription<RemoteMessage>? _foregroundSub;
  StreamSubscription<RemoteMessage>? _openedAppSub;

  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    FirebaseMessaging.onBackgroundMessage(
      _firebaseMessagingBackgroundHandler,
    );

    await _requestPermission();
    await _registerToken();
    _listenForeground();
  }

  Future<void> _requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    debugPrint('[FCM] Permission: ${settings.authorizationStatus}');
  }

  Future<void> _registerToken() async {
    try {
      final token = await _messaging.getToken();
      if (token == null) return;
      await _sendTokenToBackend(token);
      debugPrint('[FCM] Token registered');

      // Re-register whenever the token is refreshed.
      _tokenRefreshSub = _messaging.onTokenRefresh.listen(
        _sendTokenToBackend,
        onError: (Object e) =>
            debugPrint('[FCM] Token refresh stream error: $e'),
      );
    } catch (e) {
      debugPrint('[FCM] Token registration failed: $e');
    }
  }

  Future<void> _sendTokenToBackend(String token) async {
    try {
      await _dio.post<void>(
        '/api/users/me/fcm-token',
        data: {
          'token': token,
          'platform': defaultTargetPlatform == TargetPlatform.iOS
              ? 'IOS'
              : 'ANDROID',
        },
      );
    } catch (e) {
      debugPrint('[FCM] Failed to send token to backend: $e');
    }
  }

  void _listenForeground() {
    _foregroundSub = FirebaseMessaging.onMessage.listen(
      (message) {
        debugPrint('[FCM] Foreground: ${message.notification?.title}');
        // TODO: Show in-app notification banner when correction is complete.
      },
    );

    _openedAppSub = FirebaseMessaging.onMessageOpenedApp.listen(
      (message) {
        debugPrint('[FCM] Tapped from background');
        // TODO: Navigate to the relevant correction detail screen.
      },
    );
  }

  Future<void> dispose() async {
    await _tokenRefreshSub?.cancel();
    await _foregroundSub?.cancel();
    await _openedAppSub?.cancel();
  }
}

@Riverpod(keepAlive: true)
NotificationService notificationService(Ref ref) {
  final service = NotificationService(
    FirebaseMessaging.instance,
    ref.watch(dioProvider),
  );
  ref.onDispose(service.dispose);
  return service;
}
