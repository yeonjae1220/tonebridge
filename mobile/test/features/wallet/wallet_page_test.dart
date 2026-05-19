import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/auth/domain/model/user.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/wallet/data/wallet_repository_impl.dart';
import 'package:tonebridge/features/wallet/presentation/wallet_page.dart';

import '../../helpers/mocks.dart';

AuthSession _fakeSession({int credits = 42}) => AuthSession(
      user: User(
        id: 'u1',
        email: 'test@example.com',
        username: 'tester',
        nativeLanguage: 'ko',
        fluentLanguages: const [],
        learningLanguages: const ['en'],
        credits: credits,
        reputationScore: 0,
      ),
      accessToken: 'token',
      needsOnboarding: false,
    );

class _FakeAuthState extends AuthState {
  final int credits;
  _FakeAuthState({this.credits = 42});

  @override
  Future<AuthSession?> build() async => _fakeSession(credits: credits);
}

void main() {
  late MockWalletRepository mockRepo;

  setUp(() {
    registerFallbacks();
    mockRepo = MockWalletRepository();
  });

  Widget buildPage({int credits = 42}) {
    return ProviderScope(
      overrides: [
        authStateProvider.overrideWith(() => _FakeAuthState(credits: credits)),
        walletRepositoryProvider.overrideWith((ref) => mockRepo),
      ],
      child: const MaterialApp(home: WalletPage()),
    );
  }

  group('WalletPage', () {
    testWidgets('shows credit balance from auth session', (tester) async {
      when(() => mockRepo.getHistory()).thenAnswer((_) async => []);

      await tester.pumpWidget(buildPage(credits: 42));
      await tester.pumpAndSettle();

      expect(find.text('42'), findsOneWidget);
      expect(find.text('보유 크레딧'), findsOneWidget);
    });

    testWidgets('shows empty state when no transactions', (tester) async {
      when(() => mockRepo.getHistory()).thenAnswer((_) async => []);

      await tester.pumpWidget(buildPage());
      await tester.pumpAndSettle();

      expect(find.text('거래 내역이 없습니다.'), findsOneWidget);
    });

    testWidgets('shows earn/spend transaction amounts', (tester) async {
      when(() => mockRepo.getHistory()).thenAnswer(
        (_) async => [
          makeTransaction(id: 'tx-1', amount: 5, type: 'EARN'),
          makeTransaction(id: 'tx-2', amount: -3, type: 'SPEND'),
        ],
      );

      await tester.pumpWidget(buildPage());
      await tester.pumpAndSettle();

      expect(find.text('+5'), findsOneWidget);
      expect(find.text('-3'), findsOneWidget);
    });

    testWidgets('shows error UI with retry button on failure', (tester) async {
      when(() => mockRepo.getHistory()).thenThrow(Exception('network error'));

      await tester.pumpWidget(buildPage());
      await tester.pumpAndSettle();

      expect(find.text('내역을 불러올 수 없습니다'), findsOneWidget);
      expect(find.text('다시 시도'), findsOneWidget);
    });

    testWidgets('retry button triggers re-fetch after error', (tester) async {
      // First call fails, second succeeds after error recovery.
      var shouldFail = true;
      when(() => mockRepo.getHistory()).thenAnswer((_) async {
        if (shouldFail) throw Exception('fail');
        return [makeTransaction()];
      });

      await tester.pumpWidget(buildPage());
      await tester.pumpAndSettle();

      // Error state is now showing the retry button.
      expect(find.text('다시 시도'), findsOneWidget);

      // Recover — next call succeeds.
      shouldFail = false;
      await tester.tap(find.text('다시 시도'));
      await tester.pumpAndSettle();

      verify(() => mockRepo.getHistory()).called(greaterThanOrEqualTo(2));
    });
  });
}
