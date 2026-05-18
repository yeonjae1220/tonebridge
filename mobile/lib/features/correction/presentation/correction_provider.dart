import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/correction/data/correction_repository_impl.dart';
import 'package:tonebridge/features/correction/domain/model/correction_item.dart';

part 'correction_provider.g.dart';

@riverpod
Future<List<CorrectionItem>> correctionResult(
  Ref ref,
  String requestId,
) =>
    ref.watch(correctionRepositoryProvider).getCorrectionResult(requestId);

@riverpod
class SubmitCorrectionState extends _$SubmitCorrectionState {
  @override
  AsyncValue<CorrectionItem?> build() => const AsyncData(null);

  Future<void> submit({
    required String requestId,
    String? correctedText,
    required String explanation,
    List<String> tags = const [],
    int? pronunciationScore,
    int? intonationScore,
    int? fluencyScore,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(correctionRepositoryProvider).submitCorrection(
            requestId: requestId,
            correctedText: correctedText,
            explanation: explanation,
            tags: tags,
            pronunciationScore: pronunciationScore,
            intonationScore: intonationScore,
            fluencyScore: fluencyScore,
          ),
    );
  }

  void reset() => state = const AsyncData(null);
}

@riverpod
class RatingState extends _$RatingState {
  @override
  AsyncValue<void> build(String correctionId) => const AsyncData(null);

  Future<void> rate({required bool helpful}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(correctionRepositoryProvider)
          .rateCorrection(correctionId, helpful: helpful),
    );
  }
}
