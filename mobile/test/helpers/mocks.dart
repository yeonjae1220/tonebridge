import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/correction/domain/correction_repository.dart';
import 'package:tonebridge/features/correction/domain/model/correction_item.dart';
import 'package:tonebridge/features/feed/domain/feed_repository.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';
import 'package:tonebridge/features/friend/domain/friend_repository.dart';
import 'package:tonebridge/features/friend/domain/model/friend.dart';
import 'package:tonebridge/features/profile/domain/model/user_profile.dart';
import 'package:tonebridge/features/profile/domain/profile_repository.dart';
import 'package:tonebridge/features/request/domain/request_repository.dart';
import 'package:tonebridge/features/study_session/domain/model/learner_attempt.dart';
import 'package:tonebridge/features/study_session/domain/model/study_card.dart';
import 'package:tonebridge/features/study_session/domain/model/study_session.dart';
import 'package:tonebridge/features/study_session/domain/study_session_repository.dart';
import 'package:tonebridge/features/wallet/domain/model/credit_transaction.dart';
import 'package:tonebridge/features/wallet/domain/wallet_repository.dart';

class MockFeedRepository extends Mock implements FeedRepository {}

class MockCorrectionRepository extends Mock implements CorrectionRepository {}

class MockRequestRepository extends Mock implements RequestRepository {}

class MockWalletRepository extends Mock implements WalletRepository {}

class MockProfileRepository extends Mock implements ProfileRepository {}

class MockFriendRepository extends Mock implements FriendRepository {}

class MockStudySessionRepository extends Mock
    implements StudySessionRepository {}

// Fallback values for mocktail
void registerFallbacks() {
  registerFallbackValue(<CorrectionRequestItem>[]);
  registerFallbackValue(<CorrectionItem>[]);
  registerFallbackValue(<CreditTransaction>[]);
  registerFallbackValue(<String>[]);
  registerFallbackValue(<TimestampComment>[]);
  registerFallbackValue(<Friend>[]);
  registerFallbackValue(<FriendRequestItem>[]);
  registerFallbackValue(<StudySession>[]);
  registerFallbackValue(<StudyCard>[]);
  registerFallbackValue(<LearnerAttempt>[]);
}

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

CorrectionRequestItem makeRequest({
  String id = 'req-1',
  String status = 'OPEN',
  String type = 'TEXT',
  int creditCost = 5,
}) =>
    CorrectionRequestItem(
      id: id,
      requesterId: 'user-1',
      type: type,
      contentText: 'Hello world',
      targetLanguage: 'en',
      creditCost: creditCost,
      status: status,
      createdAt: DateTime(2024, 1, 1),
    );

CorrectionItem makeCorrection({
  String id = 'cor-1',
  String status = 'APPROVED',
  bool isAi = false,
}) =>
    CorrectionItem(
      id: id,
      requestId: 'req-1',
      correctorId: 'user-2',
      correctedText: 'Hello world (corrected)',
      explanation: 'Looks good',
      status: status,
      isAi: isAi,
      tags: const [],
      createdAt: DateTime(2024, 1, 1),
    );

UserProfile makeProfile({
  String id = 'user-1',
  String nativeLanguage = 'ko',
  List<String> fluentLanguages = const ['en'],
  List<String> learningLanguages = const ['ja'],
}) =>
    UserProfile(
      id: id,
      username: 'tester',
      nativeLanguage: nativeLanguage,
      fluentLanguages: fluentLanguages,
      learningLanguages: learningLanguages,
      correctionStreak: 0,
      reputationScore: 0.0,
      correctorLevel: 'BEGINNER',
    );

CreditTransaction makeTransaction({
  String id = 'tx-1',
  int amount = 5,
  String type = 'EARN',
}) =>
    CreditTransaction(
      id: id,
      userId: 'user-1',
      amount: amount,
      type: type,
      createdAt: DateTime(2024, 1, 1),
    );

Friend makeFriend({
  String id = 'friend-1',
  String username = 'alice',
  String nativeLanguage = 'en',
}) =>
    Friend(id: id, username: username, nativeLanguage: nativeLanguage);

FriendRequestItem makeFriendRequest({
  String id = 'req-1',
  String senderId = 'sender-1',
  String receiverId = 'user-1',
  String status = 'PENDING',
  String senderUsername = 'bob',
}) =>
    FriendRequestItem(
      id: id,
      senderId: senderId,
      receiverId: receiverId,
      status: status,
      senderUsername: senderUsername,
      createdAt: DateTime(2024, 1, 1),
    );

StudySession makeStudySession({
  String id = 'session-1',
  String? title,
  String createdBy = 'user-1',
  List<String> memberIds = const ['user-1', 'friend-1'],
  String status = 'ACTIVE',
}) =>
    StudySession(
      id: id,
      title: title,
      createdBy: createdBy,
      memberIds: memberIds,
      status: status,
      createdAt: DateTime(2024, 1, 1),
    );

StudyCard makeStudyCard({
  String id = 'card-1',
  String sessionId = 'session-1',
  String createdByUserId = 'user-1',
  String phrase = 'こんにちは',
  String? nativeAudioUrl,
  LearnerAttempt? latestAttempt,
}) =>
    StudyCard(
      id: id,
      sessionId: sessionId,
      createdByUserId: createdByUserId,
      phrase: phrase,
      nativeAudioUrl: nativeAudioUrl,
      createdAt: DateTime(2024, 1, 1),
      latestAttempt: latestAttempt,
    );

LearnerAttempt makeLearnerAttempt({
  String id = 'attempt-1',
  String cardId = 'card-1',
  String learnerId = 'learner-1',
  String audioUrl = 'https://example.com/audio.aac',
  String? correctionNote,
  int? score,
}) =>
    LearnerAttempt(
      id: id,
      cardId: cardId,
      learnerId: learnerId,
      audioUrl: audioUrl,
      correctionNote: correctionNote,
      score: score,
      attemptedAt: DateTime(2024, 1, 1),
    );
