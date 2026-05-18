import 'package:freezed_annotation/freezed_annotation.dart';

part 'credit_transaction.freezed.dart';
part 'credit_transaction.g.dart';

@freezed
abstract class CreditTransaction with _$CreditTransaction {
  const factory CreditTransaction({
    required String id,
    required String userId,
    required int amount,
    required String type,
    String? referenceId,
    String? note,
    DateTime? createdAt,
  }) = _CreditTransaction;

  factory CreditTransaction.fromJson(Map<String, dynamic> json) =>
      _$CreditTransactionFromJson(json);
}
