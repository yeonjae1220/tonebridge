import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/correction/domain/correction_repository.dart';
import 'package:tonebridge/features/correction/domain/model/correction_item.dart';
import 'package:tonebridge/features/feed/domain/feed_repository.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';
import 'package:tonebridge/features/request/domain/request_repository.dart';
import 'package:tonebridge/features/wallet/domain/model/credit_transaction.dart';
import 'package:tonebridge/features/wallet/domain/wallet_repository.dart';

class MockFeedRepository extends Mock implements FeedRepository {}

class MockCorrectionRepository extends Mock implements CorrectionRepository {}

class MockRequestRepository extends Mock implements RequestRepository {}

class MockWalletRepository extends Mock implements WalletRepository {}

// Fallback values for mocktail
void registerFallbacks() {
  registerFallbackValue(<CorrectionRequestItem>[]);
  registerFallbackValue(<CorrectionItem>[]);
  registerFallbackValue(<CreditTransaction>[]);
  registerFallbackValue(<String>[]);
  registerFallbackValue(<TimestampComment>[]);
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
