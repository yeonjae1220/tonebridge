import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

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
