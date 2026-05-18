import 'dart:ui';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/app.dart';
import 'package:tonebridge/firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Capture Flutter framework errors.
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    // TODO: Forward to crash reporting (e.g., Firebase Crashlytics).
    // FirebaseCrashlytics.instance.recordFlutterFatalError(details);
  };

  // Capture Dart async errors not caught by Flutter framework.
  PlatformDispatcher.instance.onError = (error, stack) {
    // TODO: Forward to crash reporting.
    // FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    debugPrint('[Error] Uncaught: $error\n$stack');
    return true;
  };

  // Replace red error screens with a neutral widget in release builds.
  if (const bool.fromEnvironment('dart.vm.product')) {
    ErrorWidget.builder = (_) => const SizedBox.shrink();
  }

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  runApp(
    ProviderScope(
      observers: const [_AppProviderObserver()],
      child: const ToneBridgeApp(),
    ),
  );
}

class _AppProviderObserver extends ProviderObserver {
  const _AppProviderObserver();

  @override
  void didAddProvider(
    ProviderBase<dynamic> provider,
    Object? value,
    ProviderContainer container,
  ) {}

  @override
  void providerDidFail(
    ProviderBase<dynamic> provider,
    Object error,
    StackTrace stackTrace,
    ProviderContainer container,
  ) {
    debugPrint('[Provider] ${provider.name ?? provider.runtimeType} failed: $error');
    // TODO: Forward to crash reporting.
  }
}
