import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/auth/domain/model/user.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/domain/model/native_audio_entry.dart';
import 'package:tonebridge/features/study_session/presentation/card_detail_page.dart';

import '../../helpers/mocks.dart';

class _SignedIn extends AuthState {
  _SignedIn(this.userId);
  final String userId;

  @override
  Future<AuthSession?> build() async => AuthSession(
    user: User(
      id: userId,
      email: 'test@example.com',
      username: userId,
      nativeLanguage: 'ko',
      fluentLanguages: const [],
      learningLanguages: const ['ja'],
      credits: 0,
    ),
    accessToken: 'test-only',
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late MockStudySessionRepository repo;
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  const recorderChannel = MethodChannel('com.llfbandit.record/messages');

  setUp(() {
    repo = MockStudySessionRepository();
    when(() => repo.getCard('card-1')).thenAnswer((_) async => makeStudyCard());
    when(
      () => repo.getAttempts('card-1'),
    ).thenAnswer((_) async => [makeLearnerAttempt(learnerId: 'user-1')]);
    when(() => repo.getNativeAudios('card-1')).thenAnswer(
      (_) async => [
        NativeAudioEntry(
          id: 'audio-1',
          cardId: 'card-1',
          createdAt: DateTime(2026, 10, 28),
        ),
      ],
    );
  });

  tearDown(() => messenger.setMockMethodCallHandler(recorderChannel, null));

  Future<void> showPage(
    WidgetTester tester, {
    String userId = 'user-1',
    double textScale = 1,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authStateProvider.overrideWith(() => _SignedIn(userId)),
          studySessionRepositoryProvider.overrideWith((ref) => repo),
        ],
        child: MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: const CardDetailPage(cardId: 'card-1', sessionId: 'session-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  for (final width in [320.0, 360.0]) {
    for (final textScale in [1.0, 2.0]) {
      for (final userId in ['user-1', 'friend-1']) {
        testWidgets('$userId attempt fits ${width}px with ${textScale}x text', (
          tester,
        ) async {
          tester.view.physicalSize = Size(width, 800);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);

          await showPage(tester, userId: userId, textScale: textScale);
          final label = find.textContaining(
            userId == 'user-1' ? '내 연습 ·' : '참여자의 연습 ·',
          );
          final playButton = find.byTooltip('발음 듣기');
          await tester.ensureVisible(playButton);
          await tester.pumpAndSettle();

          expect(tester.takeException(), isNull);
          expect(label, findsOneWidget);
          expect(playButton.hitTestable(), findsOneWidget);
          expect(
            tester.getRect(label).right,
            lessThanOrEqualTo(tester.getRect(playButton).left),
          );
          expect(tester.getRect(playButton).right, lessThanOrEqualTo(width));

          final flipHint = find.text('탭하여 뒤집기');
          await tester.ensureVisible(flipHint);
          await tester.tap(flipHint);
          await tester.pumpAndSettle();
          expect(find.text('예시 발음은 아래 녹음 목록에서 확인하세요'), findsOneWidget);

          final exampleMode = find.text('예시 발음 추가');
          await tester.ensureVisible(exampleMode);
          await tester.tap(exampleMode);
          await tester.pumpAndSettle();
          expect(find.text('녹음 추가'), findsOneWidget);
          expect(tester.takeException(), isNull);
        });
      }
    }
  }

  for (final userId in ['user-1', 'friend-1']) {
    testWidgets(
      '$userId can choose practice or an example independently of ownership',
      (tester) async {
        await showPage(tester, userId: userId);
        expect(find.text('내 발음 녹음'), findsOneWidget);
        expect(find.text('예시 발음'), findsOneWidget);
        expect(
          find.byTooltip('삭제'),
          userId == 'user-1' ? findsOneWidget : findsNothing,
        );
        expect(
          find.byType(PopupMenuButton<String>),
          userId == 'user-1' ? findsOneWidget : findsNothing,
        );

        await tester.ensureVisible(find.text('예시 발음 추가'));
        await tester.tap(find.text('예시 발음 추가'));
        await tester.pumpAndSettle();
        expect(find.text('내 발음 녹음'), findsNothing);
        expect(find.text('녹음 추가'), findsOneWidget);

        await tester.tap(find.text('내 발음 연습'));
        await tester.pumpAndSettle();
        expect(find.text('내 발음 녹음'), findsOneWidget);
        expect(find.text('녹음 추가'), findsNothing);
      },
    );
  }

  testWidgets(
    'non-owner can add feedback; failed save keeps the note and retry uses no score',
    (tester) async {
      when(
        () => repo.addCorrectionNote(any(), any(), any()),
      ).thenThrow(Exception('save failed'));
      await showPage(tester, userId: 'friend-1');
      await tester.ensureVisible(find.text('교정 메모 추가'));
      await tester.tap(find.text('교정 메모 추가'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '첫 음절을 더 길게 말해보세요.');
      await tester.tap(find.text('저장'));
      await tester.pumpAndSettle();
      expect(find.text('교정 메모 저장에 실패했어요. 다시 시도해 주세요.'), findsOneWidget);
      expect(find.text('첫 음절을 더 길게 말해보세요.'), findsOneWidget);

      final corrected = makeLearnerAttempt(
        learnerId: 'user-1',
        correctionNote: '첫 음절을 더 길게 말해보세요.',
      );
      when(
        () => repo.addCorrectionNote(any(), any(), any()),
      ).thenAnswer((_) async => corrected);
      when(
        () => repo.getAttempts('card-1'),
      ).thenAnswer((_) async => [corrected]);
      await tester.tap(find.text('저장'));
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsNothing);
      expect(find.text('첫 음절을 더 길게 말해보세요.'), findsOneWidget);
      verify(
        () => repo.addCorrectionNote('attempt-1', '첫 음절을 더 길게 말해보세요.', null),
      ).called(2);
    },
  );

  testWidgets(
    'five-point score and learner attribution are shown on the attempt',
    (tester) async {
      when(() => repo.getAttempts('card-1')).thenAnswer(
        (_) async => [
          makeLearnerAttempt(
            learnerId: 'user-1',
            correctionNote: '좋아요',
            score: 5,
          ),
        ],
      );
      await showPage(tester);
      expect(find.text('5/5'), findsOneWidget);
      expect(find.byIcon(Icons.star_rounded), findsNWidgets(5));
      expect(find.textContaining('내 연습 ·'), findsOneWidget);
    },
  );

  testWidgets(
    'recording purpose is locked while microphone permission is pending',
    (tester) async {
      final permission = Completer<bool>();
      messenger.setMockMethodCallHandler(recorderChannel, (call) async {
        if (call.method == 'create') {
          final args = call.arguments as Map<Object?, Object?>;
          messenger.setMockMethodCallHandler(
            MethodChannel('com.llfbandit.record/events/${args['recorderId']}'),
            (_) async => null,
          );
        }
        if (call.method == 'hasPermission') return permission.future;
        return null;
      });
      await showPage(tester);
      await tester.ensureVisible(find.text('녹음 시작'));
      await tester.tap(find.text('녹음 시작'));
      await tester.pump();
      final selector = tester.widget<SegmentedButton<dynamic>>(
        find.byWidgetPredicate((w) => w is SegmentedButton),
      );
      expect(selector.onSelectionChanged, isNull);
      permission.complete(false);
      await tester.pumpAndSettle();
      expect(
        find.text('마이크 권한이 필요해요. 브라우저 또는 앱 설정에서 허용해 주세요.'),
        findsOneWidget,
      );
      await tester.ensureVisible(find.text('예시 발음 추가'));
      await tester.tap(find.text('예시 발음 추가'));
      await tester.pumpAndSettle();
      expect(find.text('녹음 추가'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    },
  );
}
