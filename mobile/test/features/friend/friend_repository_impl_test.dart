import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/friend/data/friend_repository_impl.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late MockDio mockDio;
  late FriendRepositoryImpl repo;

  setUp(() {
    mockDio = MockDio();
    repo = FriendRepositoryImpl(dio: mockDio);
  });

  RequestOptions opts(String path) => RequestOptions(path: path);

  group('getFriends', () {
    test('parses response into Friend list', () async {
      when(() => mockDio.get<List<dynamic>>('/api/friends')).thenAnswer(
        (_) async => Response(
          requestOptions: opts('/api/friends'),
          data: [
            {'id': '1', 'username': 'alice', 'nativeLanguage': 'en'},
          ],
          statusCode: 200,
        ),
      );

      final result = await repo.getFriends();
      expect(result, hasLength(1));
      expect(result.first.username, 'alice');
    });

    test('returns empty list when server returns null body', () async {
      when(() => mockDio.get<List<dynamic>>('/api/friends')).thenAnswer(
        (_) async => Response<List<dynamic>>(
          requestOptions: opts('/api/friends'),
          data: null,
          statusCode: 200,
        ),
      );

      final result = await repo.getFriends();
      expect(result, isEmpty);
    });

    test('returns empty list when server returns empty array', () async {
      when(() => mockDio.get<List<dynamic>>('/api/friends')).thenAnswer(
        (_) async => Response(
          requestOptions: opts('/api/friends'),
          data: <dynamic>[],
          statusCode: 200,
        ),
      );

      final result = await repo.getFriends();
      expect(result, isEmpty);
    });
  });

  group('getPendingRequests', () {
    test('returns empty list when server returns null body', () async {
      when(() => mockDio.get<List<dynamic>>('/api/friends/pending')).thenAnswer(
        (_) async => Response<List<dynamic>>(
          requestOptions: opts('/api/friends/pending'),
          data: null,
          statusCode: 200,
        ),
      );

      final result = await repo.getPendingRequests();
      expect(result, isEmpty);
    });

    test('parses pending requests from response', () async {
      when(() => mockDio.get<List<dynamic>>('/api/friends/pending')).thenAnswer(
        (_) async => Response(
          requestOptions: opts('/api/friends/pending'),
          data: [
            {
              'id': 'req-1',
              'senderId': 'sender-1',
              'receiverId': 'me',
              'status': 'PENDING',
              'createdAt': '2024-01-01T00:00:00.000Z',
            },
          ],
          statusCode: 200,
        ),
      );

      final result = await repo.getPendingRequests();
      expect(result, hasLength(1));
      expect(result.first.id, 'req-1');
    });
  });

  group('sendRequest', () {
    test('throws Exception when server returns null body', () async {
      when(
        () => mockDio.post<Map<String, dynamic>>(
          '/api/friends/request',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response<Map<String, dynamic>>(
          requestOptions: opts('/api/friends/request'),
          data: null,
          statusCode: 200,
        ),
      );

      await expectLater(repo.sendRequest('alice'), throwsException);
    });

    test('returns parsed FriendRequestItem on success', () async {
      when(
        () => mockDio.post<Map<String, dynamic>>(
          '/api/friends/request',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: opts('/api/friends/request'),
          data: {
            'id': 'req-1',
            'senderId': 'user-1',
            'receiverId': 'user-2',
            'status': 'PENDING',
            'createdAt': '2024-01-01T00:00:00.000Z',
          },
          statusCode: 201,
        ),
      );

      final result = await repo.sendRequest('alice');
      expect(result.id, 'req-1');
      expect(result.status, 'PENDING');
    });
  });

  group('acceptRequest', () {
    test('throws Exception when server returns null body', () async {
      when(
        () => mockDio.post<Map<String, dynamic>>(
          '/api/friends/req-1/accept',
        ),
      ).thenAnswer(
        (_) async => Response<Map<String, dynamic>>(
          requestOptions: opts('/api/friends/req-1/accept'),
          data: null,
          statusCode: 200,
        ),
      );

      await expectLater(repo.acceptRequest('req-1'), throwsException);
    });
  });
}
