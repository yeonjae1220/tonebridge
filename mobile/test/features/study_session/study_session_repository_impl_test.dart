import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late MockDio dio;
  late StudySessionRepositoryImpl repo;
  const path = '/api/attempts/attempt-1/correction';
  final saved = {
    'id': 'attempt-1',
    'cardId': 'card-1',
    'learnerId': 'learner-1',
    'audioUrl': 'a.webm',
    'correctionNote': 'th 가 s 처럼 들려요.',
    'attemptedAt': '2026-11-24T00:00:00Z',
  };

  setUp(() {
    dio = MockDio();
    repo = StudySessionRepositoryImpl(dio: dio);
    when(
      () => dio.patch<Map<String, dynamic>>(path, data: any(named: 'data')),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: path),
        data: saved,
        statusCode: 200,
      ),
    );
  });

  Map<String, dynamic> sentBody() =>
      verify(
            () => dio.patch<Map<String, dynamic>>(
              path,
              data: captureAny(named: 'data'),
            ),
          ).captured.single
          as Map<String, dynamic>;

  test('chosen sounds are sent as soundTargets in order', () async {
    await repo.addCorrectionNote(
      'attempt-1',
      'th 가 s 처럼 들려요.',
      3,
      soundGuideIds: const ['en-th', 'ko-rieul'],
    );
    expect(sentBody(), {
      'correctionNote': 'th 가 s 처럼 들려요.',
      'score': 3,
      'soundTargets': [
        {'guideId': 'en-th'},
        {'guideId': 'ko-rieul'},
      ],
    });
  });

  test(
    'no chosen sounds leaves the field out, so stored sounds are kept',
    () async {
      await repo.addCorrectionNote('attempt-1', '좋아요', null);
      expect(sentBody(), {'correctionNote': '좋아요'});
    },
  );
}
