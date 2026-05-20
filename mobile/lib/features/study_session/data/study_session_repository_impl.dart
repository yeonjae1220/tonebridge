import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/study_session/domain/model/learner_attempt.dart';
import 'package:tonebridge/features/study_session/domain/model/study_card.dart';
import 'package:tonebridge/features/study_session/domain/model/study_session.dart';
import 'package:tonebridge/features/study_session/domain/study_session_repository.dart';

part 'study_session_repository_impl.g.dart';

@riverpod
StudySessionRepository studySessionRepository(Ref ref) =>
    StudySessionRepositoryImpl(dio: ref.watch(dioProvider));

class StudySessionRepositoryImpl implements StudySessionRepository {
  const StudySessionRepositoryImpl({required Dio dio}) : _dio = dio;
  final Dio _dio;

  @override
  Future<List<StudySession>> getSessions() async {
    final response = await _dio.get<List<dynamic>>('/api/sessions');
    return response.data!
        .map((e) => StudySession.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<StudySession> getSession(String sessionId) async {
    final response =
        await _dio.get<Map<String, dynamic>>('/api/sessions/$sessionId');
    return StudySession.fromJson(response.data!);
  }

  @override
  Future<StudySession> createSession(String friendId, {String? title}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/sessions',
      data: {
        'friendId': friendId,
        if (title != null) 'title': title,
      },
    );
    return StudySession.fromJson(response.data!);
  }

  @override
  Future<StudySession> endSession(String sessionId) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/api/sessions/$sessionId/end',
    );
    return StudySession.fromJson(response.data!);
  }

  @override
  Future<StudyCard> getCard(String cardId) async {
    final response =
        await _dio.get<Map<String, dynamic>>('/api/cards/$cardId');
    return StudyCard.fromJson(response.data!);
  }

  @override
  Future<List<StudyCard>> getCards(String sessionId) async {
    final response =
        await _dio.get<List<dynamic>>('/api/sessions/$sessionId/cards');
    return response.data!
        .map((e) => StudyCard.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<StudyCard> createCard({
    required String sessionId,
    required String phrase,
    String? context,
    List<String> tags = const [],
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/sessions/$sessionId/cards',
      data: {
        'phrase': phrase,
        if (context != null) 'context': context,
        'tags': tags,
      },
    );
    return StudyCard.fromJson(response.data!);
  }

  @override
  Future<Map<String, String>> getNativeAudioUploadUrl(
      String cardId, String fileName) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/cards/$cardId/native-audio',
      data: {'fileName': fileName},
    );
    return {
      'uploadUrl': response.data!['uploadUrl'] as String,
      'audioKey': response.data!['audioKey'] as String,
    };
  }

  @override
  Future<StudyCard> confirmNativeAudio(String cardId, String audioKey) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/api/cards/$cardId/native-audio',
      data: {'audioKey': audioKey},
    );
    return StudyCard.fromJson(response.data!);
  }

  @override
  Future<String> getNativeAudioDownloadUrl(String cardId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/cards/$cardId/native-audio',
    );
    return response.data!['downloadUrl'] as String;
  }

  @override
  Future<LearnerAttempt> submitAttempt(String cardId, String audioKey) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/cards/$cardId/attempts',
      data: {'audioKey': audioKey},
    );
    return LearnerAttempt.fromJson(response.data!);
  }

  @override
  Future<List<LearnerAttempt>> getAttempts(String cardId) async {
    final response =
        await _dio.get<List<dynamic>>('/api/cards/$cardId/attempts');
    return response.data!
        .map((e) => LearnerAttempt.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<LearnerAttempt> addCorrectionNote(
      String attemptId, String correctionNote, int? score) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/api/attempts/$attemptId/correction',
      data: {
        'correctionNote': correctionNote,
        if (score != null) 'score': score,
      },
    );
    return LearnerAttempt.fromJson(response.data!);
  }
}
