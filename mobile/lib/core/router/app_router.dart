import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/widgets/app_shell.dart';
import 'package:tonebridge/features/auth/domain/model/user.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/auth/presentation/login_page.dart';
import 'package:tonebridge/features/auth/presentation/onboarding/onboarding_page.dart';
import 'package:tonebridge/features/correction/presentation/correct_page.dart';
import 'package:tonebridge/features/correction/presentation/result_page.dart';
import 'package:tonebridge/features/feed/presentation/feed_page.dart';
import 'package:tonebridge/features/profile/domain/model/user_profile.dart';
import 'package:tonebridge/features/profile/presentation/language_edit_page.dart';
import 'package:tonebridge/features/profile/presentation/profile_page.dart';
import 'package:tonebridge/features/request/presentation/request_page.dart';
import 'package:tonebridge/features/wallet/presentation/wallet_page.dart';

part 'app_router.g.dart';

abstract final class AppRoute {
  static const String login = '/login';
  static const String onboarding = '/onboarding';
  static const String feed = '/feed';
  static const String request = '/request';
  static const String profile = '/profile';
  static const String languageEdit = '/profile/language-edit';
  static const String wallet = '/wallet';

  static String correct(String requestId) => '/correct/$requestId';
  static String result(String requestId) => '/result/$requestId';
}

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

@Riverpod(keepAlive: true)
GoRouter appRouter(Ref ref) {
  final listenable = _AuthStateListenable(ref);
  ref.onDispose(listenable.dispose);

  final router = GoRouter(
    initialLocation: AppRoute.feed,
    refreshListenable: listenable,
    redirect: (context, state) {
      final authAsync = ref.read(authStateProvider);
      if (authAsync.isLoading) return null;

      final session = authAsync.value;
      final isLoggedIn = session?.isLoggedIn ?? false;
      final needsOnboarding = session?.needsOnboarding ?? false;
      final path = state.uri.path;

      if (!isLoggedIn) {
        return path == AppRoute.login ? null : AppRoute.login;
      }
      if (needsOnboarding) {
        return path == AppRoute.onboarding ? null : AppRoute.onboarding;
      }
      if (path == AppRoute.login || path == AppRoute.onboarding) {
        return AppRoute.feed;
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
        path: '/correct/:requestId',
        builder: (context, state) => CorrectPage(
          requestId: state.pathParameters['requestId']!,
        ),
      ),
      GoRoute(
        path: '/result/:requestId',
        builder: (context, state) => ResultPage(
          requestId: state.pathParameters['requestId']!,
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.feed,
                builder: (context, state) => const FeedPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.request,
                builder: (context, state) => const RequestPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.profile,
                builder: (context, state) => const ProfilePage(),
                routes: [
                  GoRoute(
                    path: 'language-edit',
                    builder: (context, state) {
                      final extra = state.extra;
                      if (extra is! UserProfile) {
                        WidgetsBinding.instance.addPostFrameCallback(
                          (_) => GoRouter.of(context).go(AppRoute.profile),
                        );
                        return const SizedBox.shrink();
                      }
                      return LanguageEditPage(profile: extra);
                    },
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.wallet,
                builder: (context, state) => const WalletPage(),
              ),
            ],
          ),
        ],
      ),
    ],
  );

  ref.onDispose(router.dispose);
  return router;
}
