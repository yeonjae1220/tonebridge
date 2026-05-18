import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';
import 'package:tonebridge/features/request/data/request_repository_impl.dart';

part 'request_provider.g.dart';

@riverpod
class RequestState extends _$RequestState {
  @override
  AsyncValue<CorrectionRequestItem?> build() => const AsyncData(null);

  Future<void> submitText({
    required String targetLanguage,
    String? targetVariant,
    required String contentText,
    String? context,
    List<String> feedbackGoals = const [],
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(requestRepositoryProvider).submitTextRequest(
            targetLanguage: targetLanguage,
            targetVariant: targetVariant,
            contentText: contentText,
            context: context,
            feedbackGoals: feedbackGoals,
          ),
    );
  }

  Future<void> submitAudio({
    required String targetLanguage,
    String? targetVariant,
    required String audioKey,
    String? context,
    List<String> feedbackGoals = const [],
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(requestRepositoryProvider).submitAudioRequest(
            targetLanguage: targetLanguage,
            targetVariant: targetVariant,
            audioKey: audioKey,
            context: context,
            feedbackGoals: feedbackGoals,
          ),
    );
  }

  void reset() => state = const AsyncData(null);
}
