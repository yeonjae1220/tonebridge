import 'package:tonebridge/features/wallet/domain/model/credit_transaction.dart';

abstract interface class WalletRepository {
  Future<List<CreditTransaction>> getHistory();
}
