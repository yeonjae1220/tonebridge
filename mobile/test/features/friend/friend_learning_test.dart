import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/features/friend/data/friend_repository_impl.dart';
import 'package:tonebridge/features/friend/presentation/friend_page.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/domain/model/study_session.dart';

import '../../helpers/mocks.dart';

void main() {
  late MockFriendRepository friends;
  late MockStudySessionRepository study;

  setUp(() {
    friends = MockFriendRepository();
    study = MockStudySessionRepository();
    when(() => friends.getFriends()).thenAnswer((_) async => [makeFriend()]);
    when(() => friends.getPendingRequests()).thenAnswer((_) async => []);
  });

  Future<void> showFriends(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/friends',
      routes: [
        GoRoute(path: '/friends', builder: (_, _) => const FriendPage()),
        GoRoute(
          path: '/study/:id',
          builder: (_, state) =>
              Scaffold(body: Text('Notebook ${state.pathParameters['id']}')),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tProvider.overrideWith((_) => const ToneBridgeStrings('en')),
          friendRepositoryProvider.overrideWith((_) => friends),
          studySessionRepositoryProvider.overrideWith((_) => study),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('opens the existing shared notebook from a friend', (
    tester,
  ) async {
    when(
      () => study.getSessions(),
    ).thenAnswer((_) async => [makeStudySession()]);
    await showFriends(tester);
    await tester.tap(find.text('alice'));
    await tester.pumpAndSettle();
    expect(find.text('Notebook session-1'), findsOneWidget);
    verifyNever(() => study.createSession(any()));
  });

  testWidgets('creates a notebook only when the successful list is empty', (
    tester,
  ) async {
    when(() => study.getSessions()).thenAnswer((_) async => []);
    when(
      () => study.createSession('friend-1'),
    ).thenAnswer((_) async => makeStudySession(id: 'new'));
    await showFriends(tester);
    await tester.tap(find.text('alice'));
    await tester.pumpAndSettle();
    expect(find.text('Notebook new'), findsOneWidget);
    verify(() => study.createSession('friend-1')).called(1);
  });

  testWidgets('failed lookup does not create a duplicate and can be retried', (
    tester,
  ) async {
    when(() => study.getSessions()).thenThrow(Exception('network'));
    await showFriends(tester);
    await tester.tap(find.text('alice'));
    await tester.pumpAndSettle();
    expect(
      find.text(const ToneBridgeStrings('en').genericError),
      findsOneWidget,
    );
    verifyNever(() => study.createSession(any()));
    when(
      () => study.getSessions(),
    ).thenAnswer((_) async => [makeStudySession()]);
    await tester.tap(find.text('alice'));
    await tester.pumpAndSettle();
    expect(find.text('Notebook session-1'), findsOneWidget);
  });

  testWidgets(
    'removing a friend during lookup cancels opening and never creates for the next friend',
    (tester) async {
      final pending = Completer<List<StudySession>>();
      final alice = makeFriend();
      final bob = makeFriend(id: 'friend-2', username: 'bob');
      var list = [alice, bob];
      when(() => friends.getFriends()).thenAnswer((_) async => list);
      when(() => friends.removeFriend('friend-1')).thenAnswer((_) async {
        list = [bob];
      });
      when(() => study.getSessions()).thenAnswer((_) => pending.future);
      when(() => study.createSession('friend-2')).thenAnswer(
        (_) async =>
            makeStudySession(id: 'bob-book', memberIds: ['user-1', 'friend-2']),
      );
      await showFriends(tester);
      await tester.tap(find.text('alice'));
      await tester.pump();
      await tester.tap(find.byIcon(Icons.delete_outline_rounded).first);
      await tester.pump(const Duration(milliseconds: 350));
      await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pump(const Duration(milliseconds: 350));
      expect(find.text('alice'), findsNothing);
      pending.complete([]);
      await tester.pumpAndSettle();
      verifyNever(() => study.createSession(any()));
      expect(find.textContaining('Notebook '), findsNothing);
      // The remaining friend's action must still work after cancellation.
      when(() => study.getSessions()).thenAnswer(
        (_) async => [
          makeStudySession(
            id: 'bob-existing',
            memberIds: ['user-1', 'friend-2'],
          ),
        ],
      );
      await tester.tap(find.text('bob'));
      await tester.pumpAndSettle();
      expect(find.text('Notebook bob-existing'), findsOneWidget);
    },
  );

  testWidgets(
    'removing a friend while creation is pending ignores the late navigation',
    (tester) async {
      final creation = Completer<StudySession>();
      var list = [makeFriend(), makeFriend(id: 'friend-2', username: 'bob')];
      when(() => friends.getFriends()).thenAnswer((_) async => list);
      when(() => friends.removeFriend('friend-1')).thenAnswer((_) async {
        list = [makeFriend(id: 'friend-2', username: 'bob')];
      });
      when(() => study.getSessions()).thenAnswer((_) async => []);
      when(
        () => study.createSession('friend-1'),
      ).thenAnswer((_) => creation.future);
      await showFriends(tester);
      await tester.tap(find.text('alice'));
      await tester.pump();
      verify(() => study.createSession('friend-1')).called(1);
      await tester.tap(find.byIcon(Icons.delete_outline_rounded).first);
      await tester.pump(const Duration(milliseconds: 350));
      await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pump(const Duration(milliseconds: 350));
      expect(find.text('alice'), findsNothing);
      creation.complete(makeStudySession(id: 'late-alice'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Notebook '), findsNothing);
      expect(find.text('bob'), findsOneWidget);
      verifyNever(() => study.createSession('friend-2'));
    },
  );
}
