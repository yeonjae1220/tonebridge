import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/correction/data/correction_repository_impl.dart';
import 'package:tonebridge/features/correction/domain/model/correction_item.dart';

part 'correction_provider.g.dart';

class TimestampCommentInput {
  const TimestampCommentInput({
    required this.offsetMs,
    required this.comment,
    required this.category,
  });

  final int offsetMs;
  final String comment;
  final String category;

  TimestampComment toModel() => TimestampComment(
        offsetMs: offsetMs,
        comment: comment,
        category: category,
      );
}

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
    List<TimestampCommentInput> timestampComments = const [],
    int? pronunciationScore,
    int? intonationScore,
    int? fluencyScore,
    String? referenceAudioUrl,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(correctionRepositoryProvider).submitCorrection(
            requestId: requestId,
            correctedText: correctedText,
            explanation: explanation,
            tags: tags,
            timestampComments:
                timestampComments.map((t) => t.toModel()).toList(),
            pronunciationScore: pronunciationScore,
            intonationScore: intonationScore,
            fluencyScore: fluencyScore,
            referenceAudioUrl: referenceAudioUrl,
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

@riverpod
class CorrectionEditState extends _$CorrectionEditState {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  Future<void> update({
    required String correctionId,
    required String requestId,
    String? correctedText,
    required String explanation,
    List<String> tags = const [],
    List<TimestampComment> timestampComments = const [],
    int? pronunciationScore,
    int? intonationScore,
    int? fluencyScore,
    String? referenceAudioUrl,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await ref.read(correctionRepositoryProvider).updateCorrection(
            correctionId: correctionId,
            correctedText: correctedText,
            explanation: explanation,
            tags: tags,
            timestampComments: timestampComments,
            pronunciationScore: pronunciationScore,
            intonationScore: intonationScore,
            fluencyScore: fluencyScore,
            referenceAudioUrl: referenceAudioUrl,
          );
      ref.invalidate(correctionResultProvider(requestId));
    });
  }

  Future<void> delete({
    required String correctionId,
    required String requestId,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await ref.read(correctionRepositoryProvider).deleteCorrection(correctionId);
      ref.invalidate(correctionResultProvider(requestId));
    });
  }
}
