import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/features/auth/domain/model/user.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/notification/notification_service.dart' show notificationServiceProvider;

class ToneBridgeApp extends ConsumerStatefulWidget {
  const ToneBridgeApp({super.key});

  @override
  ConsumerState<ToneBridgeApp> createState() => _ToneBridgeAppState();
}

class _ToneBridgeAppState extends ConsumerState<ToneBridgeApp> {
  ProviderSubscription<AsyncValue<AuthSession?>>? _authSub;

  @override
  void initState() {
    super.initState();
    _init();
  }

  void _init() {
    _authSub = ref.listenManual<AsyncValue<AuthSession?>>(
      authStateProvider,
      (_, next) {
        final session = next.value;
        if (session?.isLoggedIn ?? false) {
          ref.read(notificationServiceProvider).init();
        }
      },
      fireImmediately: true,
    );
  }

  @override
  void dispose() {
    _authSub?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'ToneBridge',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF6750A4),
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF6750A4),
        brightness: Brightness.dark,
      ),
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}
