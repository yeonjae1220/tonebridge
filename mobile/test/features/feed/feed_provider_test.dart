import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/feed/data/feed_repository_impl.dart';
import 'package:tonebridge/features/feed/domain/model/feed_page_result.dart';
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
      // Riverpod 3 는 실패한 async build 를 자동 재시도해 상태가 다시 loading 이 된다 — 테스트에선 끈다.
      retry: (_, _) => null,
      overrides: [
        feedRepositoryProvider.overrideWith((ref) => mockRepo),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('FeedState', () {
    FeedPageResult page(List<String> ids, {String? next}) => FeedPageResult(
          items: [for (final id in ids) makeRequest(id: id)],
          nextCursor: next,
        );

    test('build() loads the first page', () async {
      when(() => mockRepo.getFeedPage())
          .thenAnswer((_) async => page(['req-1', 'req-2'], next: 'c1'));

      final container = makeContainer();
      final state = await container.read(feedStateProvider.future);

      expect(state.items.map((i) => i.id), ['req-1', 'req-2']);
      expect(state.hasMore, isTrue);
      verify(() => mockRepo.getFeedPage()).called(1);
    });

    test('build() exposes error state on repository failure', () async {
      when(() => mockRepo.getFeedPage()).thenThrow(Exception('network error'));

      final container = makeContainer();
      try {
        await container.read(feedStateProvider.future);
      } catch (_) {}

      expect(container.read(feedStateProvider).hasError, isTrue);
    });

    test('loadMore() appends the next page using the cursor', () async {
      when(() => mockRepo.getFeedPage())
          .thenAnswer((_) async => page(['req-1'], next: 'c1'));
      when(() => mockRepo.getFeedPage(before: 'c1'))
          .thenAnswer((_) async => page(['req-2']));

      final container = makeContainer();
      await container.read(feedStateProvider.future);
      await container.read(feedStateProvider.notifier).loadMore();

      final state = container.read(feedStateProvider).value!;
      expect(state.items.map((i) => i.id), ['req-1', 'req-2']);
      expect(state.hasMore, isFalse);
    });

    test('loadMore() failure keeps loaded items and exposes the error', () async {
      when(() => mockRepo.getFeedPage())
          .thenAnswer((_) async => page(['req-1'], next: 'c1'));
      when(() => mockRepo.getFeedPage(before: 'c1'))
          .thenThrow(Exception('network error'));

      final container = makeContainer();
      await container.read(feedStateProvider.future);
      await container.read(feedStateProvider.notifier).loadMore();

      final state = container.read(feedStateProvider).value!;
      expect(state.items.map((i) => i.id), ['req-1']);
      expect(state.loadMoreError, isNotNull);
      expect(state.hasMore, isTrue, reason: '재시도할 수 있어야 한다');
    });

    test('loadMore() does nothing on the last page', () async {
      when(() => mockRepo.getFeedPage())
          .thenAnswer((_) async => page(['req-1']));

      final container = makeContainer();
      await container.read(feedStateProvider.future);
      await container.read(feedStateProvider.notifier).loadMore();

      verify(() => mockRepo.getFeedPage()).called(1);
      verifyNever(() => mockRepo.getFeedPage(before: any(named: 'before')));
    });

    test('refresh() re-fetches the first page', () async {
      var callCount = 0;
      when(() => mockRepo.getFeedPage()).thenAnswer((_) async {
        callCount++;
        return callCount == 1 ? page(['req-1']) : page(['req-2', 'req-3']);
      });

      final container = makeContainer();
      await container.read(feedStateProvider.future);

      await container.read(feedStateProvider.notifier).refresh();
      final refreshed = await container.read(feedStateProvider.future);

      expect(refreshed.items.map((i) => i.id), ['req-2', 'req-3']);
      verify(() => mockRepo.getFeedPage()).called(2);
    });
  });

  group('correctionRequestProvider', () {
    test('loads a single request by id', () async {
      when(() => mockRepo.getRequest('req-9'))
          .thenAnswer((_) async => makeRequest(id: 'req-9'));

      final container = makeContainer();
      final request =
          await container.read(correctionRequestProvider('req-9').future);

      expect(request.id, 'req-9');
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
