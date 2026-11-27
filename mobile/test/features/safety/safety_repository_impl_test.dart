import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/safety/data/safety_repository_impl.dart';
import 'package:tonebridge/features/safety/domain/safety_repository.dart';
import 'package:tonebridge/features/study_session/domain/model/learner_attempt.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late MockDio dio;
  late SafetyRepositoryImpl repo;

  setUp(() {
    dio = MockDio();
    repo = SafetyRepositoryImpl(dio: dio);
  });

  Response<T> ok<T>(String path, T? data, [int status = 200]) => Response<T>(
    requestOptions: RequestOptions(path: path),
    data: data,
    statusCode: status,
  );

  group('report', () {
    test('sends the server enum names and a trimmed detail', () async {
      when(
        () => dio.post<Map<String, dynamic>>(
          '/api/reports',
          data: any(named: 'data'),
        ),
      ).thenAnswer((_) async => ok('/api/reports', {'id': 'r-1'}, 201));

      final id = await repo.report(
        target: ReportTarget.attemptFeedback,
        targetId: 'a-1',
        reason: ReportReason.harassment,
        detail: '  rude  ',
        alsoBlock: true,
      );

      expect(id, 'r-1');
      final body =
          verify(
                () => dio.post<Map<String, dynamic>>(
                  '/api/reports',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(body, {
        'targetType': 'ATTEMPT_FEEDBACK',
        'targetId': 'a-1',
        'reason': 'HARASSMENT',
        'detail': 'rude',
        'alsoBlock': true,
      });
    });

    test('omits a blank detail', () async {
      when(
        () => dio.post<Map<String, dynamic>>(
          '/api/reports',
          data: any(named: 'data'),
        ),
      ).thenAnswer((_) async => ok('/api/reports', {'id': 'r-1'}, 201));

      await repo.report(
        target: ReportTarget.user,
        targetId: 'u-1',
        reason: ReportReason.spam,
        detail: '   ',
      );

      final body =
          verify(
                () => dio.post<Map<String, dynamic>>(
                  '/api/reports',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(body.containsKey('detail'), isFalse);
      expect(body['alsoBlock'], isFalse);
    });

    test('a body without an id is a failure, not a silent success', () async {
      when(
        () => dio.post<Map<String, dynamic>>(
          '/api/reports',
          data: any(named: 'data'),
        ),
      ).thenAnswer((_) async => ok<Map<String, dynamic>>('/api/reports', null));

      await expectLater(
        repo.report(
          target: ReportTarget.card,
          targetId: 'c-1',
          reason: ReportReason.other,
        ),
        throwsStateError,
      );
    });
  });

  group('blocks', () {
    const path = '/api/users/me/blocks';

    test('block and unblock hit the per-user path', () async {
      when(
        () => dio.put<void>('$path/u-1'),
      ).thenAnswer((_) async => ok<void>('$path/u-1', null, 204));
      when(
        () => dio.delete<void>('$path/u-1'),
      ).thenAnswer((_) async => ok<void>('$path/u-1', null, 204));

      await repo.block('u-1');
      await repo.unblock('u-1');

      verify(() => dio.put<void>('$path/u-1')).called(1);
      verify(() => dio.delete<void>('$path/u-1')).called(1);
    });

    test('parses a page of blocked users', () async {
      when(
        () => dio.get<Map<String, dynamic>>(
          path,
          queryParameters: {'page': 0},
        ),
      ).thenAnswer(
        (_) async => ok(path, {
          'items': [
            {
              'userId': 'u-1',
              'username': 'mallory',
              'createdAt': '2026-11-26T01:00:00Z',
            },
          ],
          'nextPage': 1,
        }),
      );

      final page = await repo.blockedUsers();

      expect(page.items.single.username, 'mallory');
      expect(page.nextPage, 1);
    });

    test('a malformed list is a failure, not "nobody blocked"', () async {
      when(
        () => dio.get<Map<String, dynamic>>(
          path,
          queryParameters: {'page': 0},
        ),
      ).thenAnswer((_) async => ok(path, <String, dynamic>{}));

      await expectLater(repo.blockedUsers(), throwsStateError);
    });
  });

  test('attempts keep the feedback author so it can be reported', () {
    final attempt = LearnerAttempt.fromJson({
      'id': 'a-1',
      'cardId': 'c-1',
      'learnerId': 'me',
      'audioUrl': 'https://example.test/a.m4a',
      'correctionNote': 'Nice',
      'attemptedAt': '2026-11-26T01:00:00Z',
      'correctionAuthorId': 'friend',
    });
    expect(attempt.correctionAuthorId, 'friend');
  });
}
