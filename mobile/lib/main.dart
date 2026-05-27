import 'dart:ui';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:tonebridge/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ── OAuth token capture ───────────────────────────────────────────────────
  // The backend OAuth redirect lands at /auth/callback#token=<accessToken>.
  //
  // CRITICAL: This MUST happen BEFORE usePathUrlStrategy() / runApp().
  // GoRouter's PathUrlStrategy calls window.history.replaceState() during
  // widget-tree initialisation, which silently strips the URL hash fragment.
  // By the time authStateProvider.build() runs, Uri.base.fragment is empty.
  // Reading it here (before anything touches the URL) guarantees the token
  // is always persisted into SecureStorage before GoRouter can discard it.
  if (kIsWeb) {
    final fragment = Uri.base.fragment; // e.g. "token=eyJhbGc..."
    if (fragment.isNotEmpty) {
      final token = Uri.splitQueryString(fragment)['token'];
      if (token != null && token.isNotEmpty) {
        await const FlutterSecureStorage(
          webOptions: WebOptions(
            dbName: 'tonebridge_secure',
            publicKey: 'tonebridge_key',
          ),
        ).write(key: 'access_token', value: token);
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

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
