import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/profile/data/profile_repository_impl.dart';
import 'package:tonebridge/features/profile/presentation/profile_provider.dart';

part 'language_edit_provider.g.dart';

@riverpod
class LanguageEdit extends _$LanguageEdit {
  @override
  FutureOr<void> build() {}

  Future<bool> save({
    required String nativeLanguage,
    required List<String> fluentLanguages,
    required List<String> learningLanguages,
    String? nativeDialect,
    // TODO(phase-2): add fluentLanguageVariants + learningLanguageVariants
    //   once the fluent/learning dialect selection UI is implemented.
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await ref.read(profileRepositoryProvider).updateLanguages(
            nativeLanguage: nativeLanguage,
            fluentLanguages: fluentLanguages,
            learningLanguages: learningLanguages,
            nativeDialect: nativeDialect,
          );
    });
    if (state.hasError) return false;
    ref.invalidate(userProfileProvider);
    return true;
  }
}
