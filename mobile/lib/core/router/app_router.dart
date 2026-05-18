import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/auth/presentation/login_page.dart';
import 'package:tonebridge/features/auth/presentation/onboarding/onboarding_page.dart';

part 'app_router.g.dart';

/// Named route constants — use these instead of raw strings.
abstract final class AppRoute {
  static const String login = '/login';
  static const String onboarding = '/onboarding';
  static const String home = '/';
}

/// Bridges Riverpod auth state changes into a [Listenable] so GoRouter
/// can re-evaluate its `redirect` without recreating the router instance.
class _AuthStateListenable extends ChangeNotifier {
  _AuthStateListenable(Ref ref) {
    _sub = ref.listen<AsyncValue<AuthSession?>>(
      authStateProvider,
      (_, __) => notifyListeners(),
    );
  }

  late final ProviderSubscription<AsyncValue<AuthSession?>> _sub;

  @override
  void dispose() {
    _sub.close();
    super.dispose();
  }
}

/// Single long-lived [GoRouter] instance.
/// Uses [refreshListenable] to re-evaluate `redirect` when auth state changes.
@Riverpod(keepAlive: true)
GoRouter appRouter(Ref ref) {
  final listenable = _AuthStateListenable(ref);
  ref.onDispose(listenable.dispose);

  final router = GoRouter(
    initialLocation: AppRoute.login,
    refreshListenable: listenable,
    redirect: (context, state) {
      final authAsync = ref.read(authStateProvider);
      // While loading, don't redirect — show current screen.
      if (authAsync.isLoading) return null;

      final session = authAsync.valueOrNull;
      final isLoggedIn = session?.isLoggedIn ?? false;
      final needsOnboarding = session?.needsOnboarding ?? false;
      final path = state.uri.path;

      if (!isLoggedIn) {
        return path == AppRoute.login ? null : AppRoute.login;
      }
      // Logged in
      if (needsOnboarding) {
        return path == AppRoute.onboarding ? null : AppRoute.onboarding;
      }
      // Logged in + onboarding complete: push auth/onboarding routes to home
      if (path == AppRoute.login || path == AppRoute.onboarding) {
        return AppRoute.home;
      }
      return null;
    },
    routes: [
      GoRoute(
        path: AppRoute.login,
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: AppRoute.onboarding,
        builder: (context, state) => const OnboardingPage(),
      ),
      GoRoute(
        path: AppRoute.home,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('ToneBridge — Home (WIP)')),
        ),
      ),
    ],
  );

  ref.onDispose(router.dispose);
  return router;
}
