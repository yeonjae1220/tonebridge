import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/domain/model/learner_attempt.dart';
import 'package:tonebridge/features/study_session/domain/model/native_audio_entry.dart';
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
    final repo = ref.read(studySessionRepositoryProvider);
    final session = await repo.createSession(friendId, title: title);
    state = AsyncData(await repo.getSessions());
    return session;
  }

  Future<StudySession> endSession(String sessionId) async {
    final repo = ref.read(studySessionRepositoryProvider);
    final session = await repo.endSession(sessionId);
    state = AsyncData(await repo.getSessions());
    return session;
  }

  Future<StudySession> updateSession(String sessionId, {String? title}) async {
    final repo = ref.read(studySessionRepositoryProvider);
    final session = await repo.updateSession(sessionId, title: title);
    state = AsyncData(await repo.getSessions());
    return session;
  }

  Future<void> deleteSession(String sessionId) async {
    final repo = ref.read(studySessionRepositoryProvider);
    await repo.deleteSession(sessionId);
    state = AsyncData(await repo.getSessions());
  }
}

@riverpod
Future<List<StudyCard>> sessionCards(Ref ref, String sessionId) =>
    ref.watch(studySessionRepositoryProvider).getCards(sessionId);

@riverpod
Future<StudySession> studySession(Ref ref, String sessionId) =>
    ref.watch(studySessionRepositoryProvider).getSession(sessionId);

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

@riverpod
Future<List<NativeAudioEntry>> cardNativeAudios(Ref ref, String cardId) =>
    ref.watch(studySessionRepositoryProvider).getNativeAudios(cardId);

@riverpod
class StudyCardEditState extends _$StudyCardEditState {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  Future<void> update({
    required String cardId,
    required String sessionId,
    required String phrase,
    String? context,
    List<String> tags = const [],
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await ref.read(studySessionRepositoryProvider).updateCard(
            cardId: cardId,
            phrase: phrase,
            context: context,
            tags: tags,
          );
      ref.invalidate(cardDetailProvider(cardId));
      ref.invalidate(sessionCardsProvider(sessionId));
    });
  }

  Future<void> delete({
    required String cardId,
    required String sessionId,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await ref.read(studySessionRepositoryProvider).deleteCard(cardId);
      ref.invalidate(sessionCardsProvider(sessionId));
    });
  }
}
