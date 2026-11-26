import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/auth/domain/model/user.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/domain/model/study_card.dart';
import 'package:tonebridge/features/study_session/domain/model/study_session.dart';
import 'package:tonebridge/features/study_session/presentation/session_detail_page.dart';

import '../../helpers/mocks.dart';

class _SignedIn extends AuthState {
  @override
  Future<AuthSession?> build() async => const AuthSession(
    user: User(
      id: 'user-1',
      email: 'test@example.com',
      username: 'user-1',
      nativeLanguage: 'ko',
      fluentLanguages: [],
      learningLanguages: ['en'],
      credits: 0,
    ),
    accessToken: 'test-only',
  );
}

StudyCard _card(String id, String createdBy, String phrase) => StudyCard(
  id: id,
  sessionId: 'session-1',
  createdByUserId: createdBy,
  phrase: phrase,
  context: '한 번만 더 천천히 말해 줄래?',
  createdAt: DateTime(2026, 11, 2),
);

void main() {
  late MockStudySessionRepository repo;

  setUp(() {
    repo = MockStudySessionRepository();
    when(() => repo.getSession('session-1')).thenAnswer(
      (_) async => StudySession(
        id: 'session-1',
        title: '한국어 ↔ English',
        createdBy: 'user-1',
        status: 'ACTIVE',
        createdAt: DateTime(2026, 11, 2),
      ),
    );
    when(() => repo.getCards('session-1')).thenAnswer(
      (_) async => [
        // Own card: status chip + card menu + drag handle in the trailing column.
        _card('card-1', 'user-1', 'Could you say that again a little slower?'),
        // Friend's card: no menu.
        _card('card-2', 'friend-1', '오늘 날씨 진짜 좋다.'),
      ],
    );
    when(() => repo.getSessions()).thenAnswer((_) async => []);
  });

  for (final width in [360.0, 440.0]) {
    for (final textScale in [1.0, 1.3]) {
      testWidgets(
        'own card row with a wrapping phrase fits ${width}px at ${textScale}x',
        (tester) async {
          tester.view.physicalSize = Size(width, 900);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);

          await tester.pumpWidget(
            ProviderScope(
              overrides: [
                authStateProvider.overrideWith(_SignedIn.new),
                studySessionRepositoryProvider.overrideWith((ref) => repo),
              ],
              child: MaterialApp(
                builder: (context, child) => MediaQuery(
                  data: MediaQuery.of(
                    context,
                  ).copyWith(textScaler: TextScaler.linear(textScale)),
                  child: child!,
                ),
                home: const SessionDetailPage(sessionId: 'session-1'),
              ),
            ),
          );
          await tester.pumpAndSettle();

          expect(tester.takeException(), isNull);
          expect(find.byTooltip('카드 메뉴'), findsOneWidget);
          expect(find.byTooltip('카드 메뉴').hitTestable(), findsOneWidget);
        },
      );
    }
  }
}
