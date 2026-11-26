import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/features/friend/data/friend_repository_impl.dart';
import 'package:tonebridge/features/friend/presentation/friend_page.dart';
import 'package:tonebridge/features/safety/data/safety_repository_impl.dart';
import 'package:tonebridge/features/safety/domain/safety_repository.dart';
import 'package:tonebridge/features/safety/presentation/blocked_users_page.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';

import '../../helpers/mocks.dart';

class MockSafetyRepository extends Mock implements SafetyRepository {}

void main() {
  late MockFriendRepository friends;
  late MockStudySessionRepository study;
  late MockSafetyRepository safety;

  setUp(() {
    friends = MockFriendRepository();
    study = MockStudySessionRepository();
    safety = MockSafetyRepository();
    when(() => friends.getFriends()).thenAnswer((_) async => [makeFriend()]);
    when(() => friends.getPendingRequests()).thenAnswer((_) async => []);
    when(() => study.getSessions()).thenAnswer((_) async => []);
  });

  Future<void> show(WidgetTester tester, Widget page) async {
    final router = GoRouter(
      routes: [GoRoute(path: '/', builder: (_, _) => page)],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tProvider.overrideWith((_) => const ToneBridgeStrings('en')),
          friendRepositoryProvider.overrideWith((_) => friends),
          studySessionRepositoryProvider.overrideWith((_) => study),
          safetyRepositoryProvider.overrideWith((_) => safety),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> openFriendMenuItem(WidgetTester tester, String item) async {
    await tester.tap(find.byKey(const ValueKey('user-actions-friend-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.text(item).last);
    await tester.pumpAndSettle();
  }

  void stubReport({Object? error}) {
    when(
      () => safety.report(
        target: ReportTarget.user,
        targetId: 'friend-1',
        reason: ReportReason.harassment,
        detail: any(named: 'detail'),
        alsoBlock: any(named: 'alsoBlock'),
      ),
    ).thenAnswer((_) async {
      if (error != null) throw error;
      return 'r-1';
    });
  }

  testWidgets('a friend can be reported and blocked in one step', (
    tester,
  ) async {
    stubReport();
    await show(tester, const FriendPage());
    await openFriendMenuItem(tester, 'Report user');

    final submit = find.byKey(const ValueKey('report-submit'));
    expect(tester.widget<FilledButton>(submit).onPressed, isNull);

    await tester.tap(find.byKey(const ValueKey('report-reason-harassment')));
    await tester.tap(find.byKey(const ValueKey('report-also-block')));
    await tester.enterText(find.byType(TextField), 'keeps insulting me');
    await tester.pump();
    await tester.tap(submit);
    await tester.pumpAndSettle();

    verify(
      () => safety.report(
        target: ReportTarget.user,
        targetId: 'friend-1',
        reason: ReportReason.harassment,
        detail: 'keeps insulting me',
        alsoBlock: true,
      ),
    ).called(1);
    expect(find.textContaining('within 24 hours'), findsOneWidget);
    // Blocking removed the friendship on the server, so the list reloads.
    verify(() => friends.getFriends()).called(2);
  });

  testWidgets('a rejected report explains why and keeps the sheet open', (
    tester,
  ) async {
    stubReport(
      error: DioException(
        requestOptions: RequestOptions(path: '/api/reports'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/reports'),
          statusCode: 429,
          data: {'code': 'REPORT_003'},
        ),
      ),
    );
    await show(tester, const FriendPage());
    await openFriendMenuItem(tester, 'Report user');
    await tester.tap(find.byKey(const ValueKey('report-reason-harassment')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('report-submit')));
    await tester.pumpAndSettle();

    expect(find.textContaining('report limit'), findsOneWidget);
    expect(find.byKey(const ValueKey('report-submit')), findsOneWidget);
  });

  testWidgets('blocking asks first and then reloads the friend list', (
    tester,
  ) async {
    when(() => safety.block('friend-1')).thenAnswer((_) async {});
    await show(tester, const FriendPage());
    await openFriendMenuItem(tester, 'Block');

    expect(find.text('Block alice?'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Block'));
    await tester.pumpAndSettle();

    verify(() => safety.block('friend-1')).called(1);
    verify(() => friends.getFriends()).called(2);
    expect(find.text('Blocked.'), findsOneWidget);
  });

  testWidgets('cancelling the block dialog blocks nobody', (tester) async {
    await show(tester, const FriendPage());
    await openFriendMenuItem(tester, 'Block');
    await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
    await tester.pumpAndSettle();

    verifyNever(() => safety.block(any()));
  });

  testWidgets('blocked users can be unblocked from settings', (tester) async {
    when(() => safety.blockedUsers()).thenAnswer(
      (_) async => BlockedUsersResult(
        items: [
          BlockedUser(
            userId: 'u-1',
            username: 'mallory',
            blockedAt: DateTime.utc(2026, 11, 26),
          ),
        ],
        nextPage: null,
      ),
    );
    when(() => safety.unblock('u-1')).thenAnswer((_) async {});
    await show(tester, const BlockedUsersPage());

    expect(find.text('mallory'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Unblock'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Unblock'));
    await tester.pumpAndSettle();

    verify(() => safety.unblock('u-1')).called(1);
    expect(find.text('mallory'), findsNothing);
    expect(find.text('You haven’t blocked anyone.'), findsOneWidget);
  });
}
