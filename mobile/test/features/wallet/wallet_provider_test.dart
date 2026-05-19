import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/wallet/data/wallet_repository_impl.dart';
import 'package:tonebridge/features/wallet/presentation/wallet_provider.dart';

import '../../helpers/mocks.dart';

void main() {
  late MockWalletRepository mockRepo;

  setUp(() {
    registerFallbacks();
    mockRepo = MockWalletRepository();
  });

  ProviderContainer makeContainer() {
    final container = ProviderContainer(
      overrides: [
        walletRepositoryProvider.overrideWith((ref) => mockRepo),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('creditHistoryProvider', () {
    test('returns list from repository', () async {
      final txs = [
        makeTransaction(id: 'tx-1', amount: 5, type: 'EARN'),
        makeTransaction(id: 'tx-2', amount: -3, type: 'SPEND'),
      ];
      when(() => mockRepo.getHistory()).thenAnswer((_) async => txs);

      final container = makeContainer();
      final history = await container.read(creditHistoryProvider.future);

      expect(history, equals(txs));
      expect(history[0].amount, equals(5));
      expect(history[1].type, equals('SPEND'));
    });

    test('exposes error when repository throws', () async {
      when(() => mockRepo.getHistory()).thenThrow(Exception('unauthorized'));

      final container = makeContainer();
      try {
        await container.read(creditHistoryProvider.future);
      } catch (_) {}

      expect(container.read(creditHistoryProvider).hasError, isTrue);
    });

    test('returns empty list when history is empty', () async {
      when(() => mockRepo.getHistory()).thenAnswer((_) async => []);

      final container = makeContainer();
      final history = await container.read(creditHistoryProvider.future);

      expect(history, isEmpty);
    });

    test('invalidating provider re-fetches from repository', () async {
      var callCount = 0;
      when(() => mockRepo.getHistory()).thenAnswer((_) async {
        callCount++;
        return callCount == 1
            ? [makeTransaction(id: 'tx-1')]
            : [makeTransaction(id: 'tx-1'), makeTransaction(id: 'tx-2')];
      });

      final container = makeContainer();
      await container.read(creditHistoryProvider.future);

      container.invalidate(creditHistoryProvider);
      final refreshed = await container.read(creditHistoryProvider.future);

      expect(refreshed.length, equals(2));
      verify(() => mockRepo.getHistory()).called(2);
    });
  });
}
