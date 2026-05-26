import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:tonebridge/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Switch from hash-based URLs (/#/login) to path-based URLs (/login).
  // Required so the backend OAuth callback redirect (/auth/callback) is
  // recognised by GoRouter as the real /auth/callback route instead of
  // falling back to initialLocation.  No-op on native (Android/iOS).
  usePathUrlStrategy();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('[Error] Uncaught: $error\n$stack');
    return true;
  };

  if (const bool.fromEnvironment('dart.vm.product')) {
    ErrorWidget.builder = (_) => const SizedBox.shrink();
  }

  runApp(
    ProviderScope(
      observers: const [_AppProviderObserver()],
      child: const ToneBridgeApp(),
    ),
  );
}

base class _AppProviderObserver extends ProviderObserver {
  const _AppProviderObserver();

  @override
  void providerDidFail(
    ProviderObserverContext context,
    Object error,
    StackTrace stackTrace,
  ) {
    debugPrint('[Provider] ${context.provider.name ?? context.provider.runtimeType} failed: $error');
  }
}
