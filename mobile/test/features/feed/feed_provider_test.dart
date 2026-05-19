import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/feed/data/feed_repository_impl.dart';
import 'package:tonebridge/features/feed/presentation/feed_provider.dart';

import '../../helpers/mocks.dart';

void main() {
  late MockFeedRepository mockRepo;

  setUp(() {
    registerFallbacks();
    mockRepo = MockFeedRepository();
  });

  ProviderContainer makeContainer() {
    final container = ProviderContainer(
      overrides: [
        feedRepositoryProvider.overrideWith((ref) => mockRepo),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('FeedState', () {
    test('build() loads feed on init', () async {
      final items = [makeRequest(id: 'req-1'), makeRequest(id: 'req-2')];
      when(() => mockRepo.getFeed()).thenAnswer((_) async => items);

      final container = makeContainer();
      final state = await container.read(feedStateProvider.future);

      expect(state, equals(items));
      verify(() => mockRepo.getFeed()).called(1);
    });

    test('build() exposes error state on repository failure', () async {
      when(() => mockRepo.getFeed()).thenThrow(Exception('network error'));

      final container = makeContainer();
      // Trigger provider build — thenThrow causes synchronous throw which
      // Riverpod captures as AsyncError on the same tick.
      try {
        await container.read(feedStateProvider.future);
      } catch (_) {}

      expect(container.read(feedStateProvider).hasError, isTrue);
    });

    test('refresh() re-fetches via invalidateSelf', () async {
      final first = [makeRequest(id: 'req-1')];
      final second = [makeRequest(id: 'req-2'), makeRequest(id: 'req-3')];
      var callCount = 0;

      when(() => mockRepo.getFeed()).thenAnswer((_) async {
        callCount++;
        return callCount == 1 ? first : second;
      });

      final container = makeContainer();
      await container.read(feedStateProvider.future);

      await container.read(feedStateProvider.notifier).refresh();
      final refreshed = await container.read(feedStateProvider.future);

      expect(refreshed, equals(second));
      verify(() => mockRepo.getFeed()).called(2);
    });
  });

  group('MyRequestsState', () {
    test('build() loads my requests', () async {
      final items = [makeRequest(id: 'mine-1')];
      when(() => mockRepo.getMyRequests()).thenAnswer((_) async => items);

      final container = makeContainer();
      final state = await container.read(myRequestsStateProvider.future);

      expect(state, equals(items));
    });

    test('refresh() re-fetches my requests', () async {
      var callCount = 0;
      when(() => mockRepo.getMyRequests()).thenAnswer((_) async {
        callCount++;
        return callCount == 1 ? [makeRequest(id: 'v1')] : [makeRequest(id: 'v2')];
      });

      final container = makeContainer();
      await container.read(myRequestsStateProvider.future);

      await container.read(myRequestsStateProvider.notifier).refresh();
      final refreshed = await container.read(myRequestsStateProvider.future);

      expect(refreshed.first.id, equals('v2'));
    });
  });
}
