import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/config/app_config.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/core/router/app_router.dart';

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
///   - Listens for foreground messages (in-app SnackBar banner)
///   - Handles notification taps from background and terminated states
class NotificationService {
  NotificationService(this._messaging, this._dio, this._getRouter);

  final FirebaseMessaging _messaging;
  final Dio _dio;

  /// Lazy getter — router is only read when a navigation event fires,
  /// ensuring the router is fully initialised by that point.
  final GoRouter Function() _getRouter;

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
    await _handleInitialMessage();
  }

  Future<void> _requestPermission() async {
    final settings = await _messaging.requestPermission();
    debugPrint('[FCM] Permission: ${settings.authorizationStatus}');
  }

  Future<void> _registerToken() async {
    try {
      final token = kIsWeb && AppConfig.vapidKey.isNotEmpty
          ? await _messaging.getToken(vapidKey: AppConfig.vapidKey)
          : await _messaging.getToken();
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
      final platform = kIsWeb
          ? 'WEB'
          : defaultTargetPlatform == TargetPlatform.iOS
              ? 'IOS'
              : 'ANDROID';
      await _dio.post<void>(
        '/api/users/me/fcm-token',
        data: {'token': token, 'platform': platform},
      );
    } catch (e) {
      debugPrint('[FCM] Failed to send token to backend: $e');
    }
  }

  void _listenForeground() {
    _foregroundSub = FirebaseMessaging.onMessage.listen(_showForegroundBanner);
    _openedAppSub = FirebaseMessaging.onMessageOpenedApp.listen(_navigate);
  }

  /// Handles the case when the app was launched from a terminated state
  /// by tapping a notification. A brief delay is needed so the router
  /// finishes mounting its initial route before we navigate.
  Future<void> _handleInitialMessage() async {
    final message = await _messaging.getInitialMessage();
    if (message != null) {
      await Future<void>.delayed(const Duration(milliseconds: 600));
      _navigate(message);
    }
  }

  /// Shows an in-app [SnackBar] banner while the app is in the foreground,
  /// with a "보기" action that navigates to the relevant screen.
  void _showForegroundBanner(RemoteMessage message) {
    final title = _titleFor(message);
    if (title == null) return;

    final router = _getRouter();
    final context = router.routerDelegate.navigatorKey.currentContext;
    if (context == null || !context.mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(title),
        action: SnackBarAction(
          label: '보기',
          onPressed: () => _navigate(message),
        ),
      ),
    );
  }

  /// Maps an FCM message to a human-readable banner title.
  String? _titleFor(RemoteMessage message) {
    return switch (message.data['type'] as String?) {
      'NEW_STUDY_CARD' => '새 학습 카드가 추가됐어요',
      'CORRECTION_NOTE_ADDED' =>
        '${message.data['senderUsername'] ?? '파트너'}님이 첨삭을 남겼어요',
      'CORRECTION_READY' => '첨삭 결과가 준비됐어요',
      _ => message.notification?.title,
    };
  }

  /// Routes to the appropriate screen based on the FCM message type.
  ///
  /// | type                   | data fields           | destination            |
  /// |------------------------|-----------------------|------------------------|
  /// | NEW_STUDY_CARD         | sessionId             | SessionDetailPage      |
  /// | CORRECTION_NOTE_ADDED  | sessionId + cardId    | CardDetailPage         |
  /// | CORRECTION_READY       | correctionId          | ResultPage             |
  void _navigate(RemoteMessage message) {
    final data = message.data;
    final path = switch (data['type'] as String?) {
      'NEW_STUDY_CARD' => _sessionPath(data),
      'CORRECTION_NOTE_ADDED' => _cardPath(data),
      'CORRECTION_READY' => _resultPath(data),
      _ => null,
    };

    if (path != null) {
      _getRouter().go(path);
      debugPrint('[FCM] Navigating to $path');
    }
  }

  String? _sessionPath(Map<String, dynamic> data) {
    final sessionId = data['sessionId'] as String?;
    return sessionId != null ? AppRoute.sessionDetail(sessionId) : null;
  }

  String? _cardPath(Map<String, dynamic> data) {
    final sessionId = data['sessionId'] as String?;
    final cardId = data['cardId'] as String?;
    if (sessionId == null || cardId == null) return null;
    return AppRoute.cardDetail(sessionId, cardId);
  }

  String? _resultPath(Map<String, dynamic> data) {
    final correctionId = data['correctionId'] as String?;
    return correctionId != null ? AppRoute.result(correctionId) : null;
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
    () => ref.read(appRouterProvider),
  );
  ref.onDispose(service.dispose);
  return service;
}
