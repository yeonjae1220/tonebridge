import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/domain/model/learner_attempt.dart';
import 'package:tonebridge/features/study_session/domain/model/study_card.dart';
import 'package:tonebridge/features/study_session/domain/model/study_session.dart';

part 'study_provider.g.dart';

@riverpod
class StudySessionListState extends _$StudySessionListState {
  @override
  Future<List<StudySession>> build() =>
      ref.watch(studySessionRepositoryProvider).getSessions();

  Future<void> refresh() {
    ref.invalidateSelf();
    return future;
  }

  Future<StudySession> createSession(String friendId, {String? title}) async {
    final session = await ref
        .read(studySessionRepositoryProvider)
        .createSession(friendId, title: title);
    await refresh();
    return session;
  }
}

@riverpod
Future<List<StudyCard>> sessionCards(Ref ref, String sessionId) =>
    ref.watch(studySessionRepositoryProvider).getCards(sessionId);

@riverpod
class CardAttemptState extends _$CardAttemptState {
  @override
  AsyncValue<LearnerAttempt?> build() => const AsyncData(null);

  Future<void> submit(String cardId, String audioKey) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() =>
        ref.read(studySessionRepositoryProvider).submitAttempt(cardId, audioKey));
  }

  Future<void> addNote(String attemptId, String note, int? score) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref
        .read(studySessionRepositoryProvider)
        .addCorrectionNote(attemptId, note, score));
  }

  void reset() => state = const AsyncData(null);
}

@riverpod
Future<StudyCard> cardDetail(Ref ref, String cardId) =>
    ref.watch(studySessionRepositoryProvider).getCard(cardId);

@riverpod
Future<List<LearnerAttempt>> cardAttempts(Ref ref, String cardId) =>
    ref.watch(studySessionRepositoryProvider).getAttempts(cardId);
