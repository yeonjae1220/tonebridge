import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/wallet/data/wallet_repository_impl.dart';
import 'package:tonebridge/features/wallet/domain/model/credit_transaction.dart';

part 'wallet_provider.g.dart';

@riverpod
Future<List<CreditTransaction>> creditHistory(Ref ref) =>
    ref.watch(walletRepositoryProvider).getHistory();
