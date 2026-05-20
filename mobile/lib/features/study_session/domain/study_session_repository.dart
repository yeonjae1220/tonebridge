import 'package:tonebridge/features/study_session/domain/model/learner_attempt.dart';
import 'package:tonebridge/features/study_session/domain/model/study_card.dart';
import 'package:tonebridge/features/study_session/domain/model/study_session.dart';

abstract interface class StudySessionRepository {
  Future<List<StudySession>> getSessions();
  Future<StudySession> getSession(String sessionId);
  Future<StudySession> createSession(String friendId, {String? title});
  Future<StudySession> endSession(String sessionId);
  Future<StudyCard> getCard(String cardId);
  Future<List<StudyCard>> getCards(String sessionId);
  Future<StudyCard> createCard({
    required String sessionId,
    required String phrase,
    String? context,
    List<String> tags,
  });
  Future<Map<String, String>> getNativeAudioUploadUrl(String cardId, String fileName);
  Future<StudyCard> confirmNativeAudio(String cardId, String audioKey);
  Future<String> getNativeAudioDownloadUrl(String cardId);
  Future<LearnerAttempt> submitAttempt(String cardId, String audioKey);
  Future<List<LearnerAttempt>> getAttempts(String cardId);
  Future<LearnerAttempt> addCorrectionNote(
      String attemptId, String correctionNote, int? score);
}
