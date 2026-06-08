import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/widgets/app_shell.dart';
import 'package:tonebridge/features/admin/presentation/admin_page.dart';
import 'package:tonebridge/features/admin/presentation/admin_users_page.dart';
import 'package:tonebridge/features/auth/domain/model/user.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/auth/presentation/login_page.dart';
import 'package:tonebridge/features/auth/presentation/onboarding/onboarding_page.dart';
import 'package:tonebridge/features/correction/presentation/correct_page.dart';
import 'package:tonebridge/features/correction/presentation/result_page.dart';
import 'package:tonebridge/features/feed/presentation/feed_page.dart';
import 'package:tonebridge/features/friend/presentation/friend_page.dart';
import 'package:tonebridge/features/profile/domain/model/user_profile.dart';
import 'package:tonebridge/features/profile/presentation/language_edit_page.dart';
import 'package:tonebridge/features/profile/presentation/profile_page.dart';
import 'package:tonebridge/features/profile/presentation/profile_settings_page.dart';
import 'package:tonebridge/features/request/presentation/request_page.dart';
import 'package:tonebridge/features/study_session/domain/model/study_card.dart';
import 'package:tonebridge/features/study_session/presentation/card_detail_page.dart';
import 'package:tonebridge/features/study_session/presentation/session_detail_page.dart';
import 'package:tonebridge/features/study_session/presentation/study_page.dart';
import 'package:tonebridge/features/wallet/presentation/wallet_page.dart';

part 'app_router.g.dart';

abstract final class AppRoute {
  static const String login = '/login';
  static const String onboarding = '/onboarding';
  static const String authCallback = '/auth/callback';
  static const String community = '/community';
  static const String request = '/request';
  static const String friends = '/friends';
  static const String profile = '/profile';
  static const String languageEdit = '/profile/language-edit';
  static const String wallet = '/profile/wallet';
  static const String profileSettings = '/profile/settings';
  static const String study = '/study';
  static const String admin = '/admin';
  static const String adminUsers = '/admin/users';

  static String correct(String requestId) => '/correct/$requestId';
  static String result(String requestId) => '/result/$requestId';
  static String sessionDetail(String sessionId) => '/study/$sessionId';
  static String cardDetail(String sessionId, String cardId) =>
      '/study/$sessionId/cards/$cardId';
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
    initialLocation: AppRoute.study,
    refreshListenable: listenable,
    redirect: (context, state) {
      final authAsync = ref.read(authStateProvider);
      if (authAsync.isLoading) return null;

      final session = authAsync.value;
      final isLoggedIn = session?.isLoggedIn ?? false;
      final needsOnboarding = session?.needsOnboarding ?? false;
      final path = state.uri.path;

      if (!isLoggedIn) {
        // Allow /auth/callback to stay — authStateProvider.build() reads the
        // URL hash (#token=…) set by the backend OAuth redirect. Sending the
        // user to /login here would discard the hash before it is processed.
        if (path == AppRoute.login || path == AppRoute.authCallback) {
          return null;
        }
        return AppRoute.login;
      }
      if (needsOnboarding) {
        return path == AppRoute.onboarding ? null : AppRoute.onboarding;
      }
      // After login: redirect post-auth pages and the bare root path
      // (used by the PWA manifest start_url: "/") to the study home.
      if (path == '/' ||
          path == AppRoute.login ||
          path == AppRoute.onboarding ||
          path == AppRoute.authCallback) {
        return AppRoute.study;
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
        path: AppRoute.authCallback,
        builder: (context, state) => const _AuthCallbackPage(),
      ),
      GoRoute(
        path: '/correct/:requestId',
        builder: (context, state) =>
            CorrectPage(requestId: state.pathParameters['requestId']!),
      ),
      GoRoute(
        path: '/result/:requestId',
        builder: (context, state) =>
            ResultPage(requestId: state.pathParameters['requestId']!),
      ),
      GoRoute(
        path: AppRoute.request,
        builder: (context, state) {
          final extra = state.extra;
          final returnRoute = extra == AppRoute.study
              ? AppRoute.study
              : AppRoute.community;
          final initialDestination =
              extra == AppRoute.study || extra == AppRoute.community
              ? RequestDestination.community
              : RequestDestination.personal;
          return RequestPage(
            returnRoute: returnRoute,
            initialDestination: initialDestination,
          );
        },
      ),
      GoRoute(
        path: AppRoute.admin,
        builder: (context, state) => const AdminPage(),
        routes: [
          GoRoute(
            path: 'users',
            builder: (context, state) => const AdminUsersPage(),
          ),
        ],
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.study,
                builder: (context, state) => const StudyPage(),
                routes: [
                  GoRoute(
                    path: ':sessionId',
                    builder: (context, state) => SessionDetailPage(
                      sessionId: state.pathParameters['sessionId']!,
                    ),
                    routes: [
                      GoRoute(
                        path: 'cards/:cardId',
                        builder: (context, state) => CardDetailPage(
                          cardId: state.pathParameters['cardId']!,
                          sessionId: state.pathParameters['sessionId']!,
                          initialCard: state.extra is StudyCard
                              ? state.extra as StudyCard
                              : null,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.community,
                builder: (context, state) => const FeedPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoute.friends,
                builder: (context, state) => const FriendPage(),
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
                  GoRoute(
                    path: 'wallet',
                    builder: (context, state) => const WalletPage(),
                  ),
                  GoRoute(
                    path: 'settings',
                    builder: (context, state) => const ProfileSettingsPage(),
                  ),
                ],
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

class _AuthCallbackPage extends ConsumerStatefulWidget {
  const _AuthCallbackPage();

  @override
  ConsumerState<_AuthCallbackPage> createState() => _AuthCallbackPageState();
}

class _AuthCallbackPageState extends ConsumerState<_AuthCallbackPage> {
  @override
  void initState() {
    super.initState();
    // authStateProvider.build() already extracts the token from the URL hash.
    // Invalidate only if it completed without a session (e.g. network error)
    // so it can retry the cookie-based refresh.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final auth = ref.read(authStateProvider);
      if (!auth.isLoading && auth.value == null) {
        ref.invalidate(authStateProvider);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
