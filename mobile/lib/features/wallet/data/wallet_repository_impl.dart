import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/wallet/domain/model/credit_transaction.dart';
import 'package:tonebridge/features/wallet/domain/wallet_repository.dart';

part 'wallet_repository_impl.g.dart';

@riverpod
WalletRepository walletRepository(Ref ref) =>
    WalletRepositoryImpl(dio: ref.watch(dioProvider));

class WalletRepositoryImpl implements WalletRepository {
  const WalletRepositoryImpl({required Dio dio}) : _dio = dio;
  final Dio _dio;

  @override
  Future<List<CreditTransaction>> getHistory() async {
    final response =
        await _dio.get<List<dynamic>>('/api/credits/history');
    return response.data!
        .map((e) => CreditTransaction.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
