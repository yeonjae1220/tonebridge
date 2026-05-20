import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/friend/data/friend_repository_impl.dart';
import 'package:tonebridge/features/friend/domain/model/friend.dart';
import 'package:tonebridge/features/friend/presentation/friend_provider.dart';

import '../../helpers/mocks.dart';

void main() {
  late MockFriendRepository mockRepo;

  setUp(() {
    registerFallbacks();
    mockRepo = MockFriendRepository();
  });

  ProviderContainer makeContainer() {
    final container = ProviderContainer(
      overrides: [
        friendRepositoryProvider.overrideWith((ref) => mockRepo),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('FriendListState', () {
    test('build() loads friends from repository', () async {
      final friends = [makeFriend()];
      when(() => mockRepo.getFriends()).thenAnswer((_) async => friends);

      final container = makeContainer();
      final result = await container.read(friendListStateProvider.future);

      expect(result, equals(friends));
      verify(() => mockRepo.getFriends()).called(1);
    });

    test('build() exposes error when repository throws', () async {
      when(() => mockRepo.getFriends()).thenThrow(Exception('network error'));

      final container = makeContainer();
      await container
          .read(friendListStateProvider.future)
          .then((_) => null)
          .onError((_, __) => null);

      expect(container.read(friendListStateProvider).hasError, isTrue);
    });

    test('sendRequest() calls repository and refreshes friend list', () async {
      final friends = [makeFriend()];
      when(() => mockRepo.getFriends()).thenAnswer((_) async => friends);
      when(() => mockRepo.sendRequest(any()))
          .thenAnswer((_) async => makeFriendRequest());

      final container = makeContainer();
      await container.read(friendListStateProvider.future);

      await container
          .read(friendListStateProvider.notifier)
          .sendRequest('alice');

      verify(() => mockRepo.sendRequest('alice')).called(1);
      // getFriends called once on build + once on refresh
      verify(() => mockRepo.getFriends()).called(2);
    });

    test('sendRequest() propagates exception from repository', () async {
      when(() => mockRepo.getFriends()).thenAnswer((_) async => []);
      when(() => mockRepo.sendRequest(any()))
          .thenThrow(Exception('USER_NOT_FOUND'));

      final container = makeContainer();
      await container.read(friendListStateProvider.future);

      expect(
        () => container
            .read(friendListStateProvider.notifier)
            .sendRequest('ghost'),
        throwsException,
      );
    });

    test(
        'acceptRequest() calls repository, invalidates pendingFriendRequests, and refreshes friends',
        () async {
      final friends = [makeFriend()];
      final pending = [makeFriendRequest()];

      when(() => mockRepo.getFriends()).thenAnswer((_) async => friends);
      when(() => mockRepo.getPendingRequests())
          .thenAnswer((_) async => pending);
      when(() => mockRepo.acceptRequest(any()))
          .thenAnswer((_) async => makeFriendRequest(status: 'ACCEPTED'));

      final container = makeContainer();
      // Warm up both providers
      await container.read(friendListStateProvider.future);
      await container.read(pendingFriendRequestsProvider.future);

      await container
          .read(friendListStateProvider.notifier)
          .acceptRequest('req-1');

      // Re-read pending provider to trigger the invalidated re-fetch
      await container.read(pendingFriendRequestsProvider.future);

      verify(() => mockRepo.acceptRequest('req-1')).called(1);
      // pendingFriendRequests called once on warm-up, once after invalidation
      verify(() => mockRepo.getPendingRequests()).called(2);
      // friends refreshed after accept (once on build + once via refresh())
      verify(() => mockRepo.getFriends()).called(2);
    });
  });

  group('pendingFriendRequestsProvider', () {
    test('loads pending requests from repository', () async {
      final requests = [
        makeFriendRequest(),
        makeFriendRequest(id: 'req-2', senderId: 'sender-2')
      ];
      when(() => mockRepo.getPendingRequests())
          .thenAnswer((_) async => requests);

      final container = makeContainer();
      final result = await container.read(pendingFriendRequestsProvider.future);

      expect(result, hasLength(2));
      expect(result.first.id, equals('req-1'));
    });

    test('exposes error when getPendingRequests throws', () async {
      when(() => mockRepo.getPendingRequests())
          .thenThrow(Exception('unauthorized'));

      final container = makeContainer();
      await container
          .read(pendingFriendRequestsProvider.future)
          .then((_) => null)
          .onError((_, __) => null);

      expect(container.read(pendingFriendRequestsProvider).hasError, isTrue);
    });

    test('returns empty list when no pending requests', () async {
      when(() => mockRepo.getPendingRequests())
          .thenAnswer((_) async => <FriendRequestItem>[]);

      final container = makeContainer();
      final result = await container.read(pendingFriendRequestsProvider.future);

      expect(result, isEmpty);
    });
  });
}
