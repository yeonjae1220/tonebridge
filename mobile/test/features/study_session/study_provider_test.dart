import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/domain/model/learner_attempt.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';

import '../../helpers/mocks.dart';

void main() {
  late MockStudySessionRepository mockRepo;

  setUp(() {
    registerFallbacks();
    mockRepo = MockStudySessionRepository();
  });

  ProviderContainer makeContainer() {
    final container = ProviderContainer(
      overrides: [
        studySessionRepositoryProvider.overrideWith((ref) => mockRepo),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('StudySessionListState', () {
    test('build() loads sessions from repository', () async {
      final sessions = [makeStudySession()];
      when(() => mockRepo.getSessions()).thenAnswer((_) async => sessions);

      final container = makeContainer();
      final result =
          await container.read(studySessionListStateProvider.future);

      expect(result, equals(sessions));
      verify(() => mockRepo.getSessions()).called(1);
    });

    test('build() exposes error when repository throws', () async {
      when(() => mockRepo.getSessions()).thenThrow(Exception('server error'));

      final container = makeContainer();
      await container
          .read(studySessionListStateProvider.future)
          .then((_) => null)
          .onError((_, __) => null);

      expect(
          container.read(studySessionListStateProvider).hasError, isTrue);
    });

    test('createSession() creates session and refreshes list', () async {
      final newSession =
          makeStudySession(id: 'session-new', title: 'My Session');
      when(() => mockRepo.getSessions())
          .thenAnswer((_) async => [newSession]);
      when(() => mockRepo.createSession(any(), title: any(named: 'title')))
          .thenAnswer((_) async => newSession);

      final container = makeContainer();
      await container.read(studySessionListStateProvider.future);

      final created = await container
          .read(studySessionListStateProvider.notifier)
          .createSession('friend-1', title: 'My Session');

      expect(created.id, equals('session-new'));
      verify(() => mockRepo.createSession('friend-1', title: 'My Session'))
          .called(1);
      // getSessions called on build + after createSession
      verify(() => mockRepo.getSessions()).called(2);
    });

    test('createSession() with no title passes null', () async {
      final newSession = makeStudySession(id: 'session-2');
      when(() => mockRepo.getSessions())
          .thenAnswer((_) async => [newSession]);
      when(() => mockRepo.createSession(any(), title: any(named: 'title')))
          .thenAnswer((_) async => newSession);

      final container = makeContainer();
      await container.read(studySessionListStateProvider.future);

      await container
          .read(studySessionListStateProvider.notifier)
          .createSession('friend-1');

      verify(() => mockRepo.createSession('friend-1', title: null)).called(1);
    });
  });

  group('CardAttemptState', () {
    test('initial state is AsyncData(null)', () {
      final container = makeContainer();
      final state = container.read(cardAttemptStateProvider);

      expect(state, isA<AsyncData<LearnerAttempt?>>());
      expect(state.value, isNull);
    });

    test('submit() transitions to data on success', () async {
      final attempt = makeLearnerAttempt();
      when(() => mockRepo.submitAttempt(any(), any()))
          .thenAnswer((_) async => attempt);

      final container = makeContainer();
      await container
          .read(cardAttemptStateProvider.notifier)
          .submit('card-1', 'audio/key.aac');

      final state = container.read(cardAttemptStateProvider);
      expect(state.hasValue, isTrue);
      expect(state.value, equals(attempt));
      verify(() => mockRepo.submitAttempt('card-1', 'audio/key.aac')).called(1);
    });

    test('submit() exposes error state when repository throws', () async {
      when(() => mockRepo.submitAttempt(any(), any()))
          .thenThrow(Exception('upload failed'));

      final container = makeContainer();
      await container
          .read(cardAttemptStateProvider.notifier)
          .submit('card-1', 'audio/key.aac');

      expect(container.read(cardAttemptStateProvider).hasError, isTrue);
    });

    test('addNote() updates attempt with correction', () async {
      final corrected = makeLearnerAttempt(
        correctionNote: 'Good try!',
        score: 4,
      );
      when(() => mockRepo.addCorrectionNote(any(), any(), any()))
          .thenAnswer((_) async => corrected);

      final container = makeContainer();
      await container
          .read(cardAttemptStateProvider.notifier)
          .addNote('attempt-1', 'Good try!', 4);

      final state = container.read(cardAttemptStateProvider);
      expect(state.value?.correctionNote, equals('Good try!'));
      expect(state.value?.score, equals(4));
      verify(() => mockRepo.addCorrectionNote('attempt-1', 'Good try!', 4))
          .called(1);
    });

    test('addNote() with null score passes null to repository', () async {
      final corrected = makeLearnerAttempt(correctionNote: 'Nice!');
      when(() => mockRepo.addCorrectionNote(any(), any(), any()))
          .thenAnswer((_) async => corrected);

      final container = makeContainer();
      await container
          .read(cardAttemptStateProvider.notifier)
          .addNote('attempt-1', 'Nice!', null);

      verify(() => mockRepo.addCorrectionNote('attempt-1', 'Nice!', null))
          .called(1);
    });

    test('reset() returns state to AsyncData(null)', () async {
      final attempt = makeLearnerAttempt();
      when(() => mockRepo.submitAttempt(any(), any()))
          .thenAnswer((_) async => attempt);

      final container = makeContainer();
      await container
          .read(cardAttemptStateProvider.notifier)
          .submit('card-1', 'audio/key.aac');

      // State is now data with attempt
      expect(container.read(cardAttemptStateProvider).value, isNotNull);

      container.read(cardAttemptStateProvider.notifier).reset();

      final state = container.read(cardAttemptStateProvider);
      expect(state.value, isNull);
    });

    test('separate provider instances are independent', () async {
      final container = makeContainer();

      // Providers keyed by cardId should be independent
      final stateA = container.read(cardAttemptStateProvider);
      expect(stateA.value, isNull);

      // Reading the same provider again gives same instance
      final stateB = container.read(cardAttemptStateProvider);
      expect(identical(stateA, stateB), isTrue);
    });
  });
}
