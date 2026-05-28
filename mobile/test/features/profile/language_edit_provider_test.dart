import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/profile/data/profile_repository_impl.dart';
import 'package:tonebridge/features/profile/presentation/language_edit_provider.dart';

import '../../helpers/mocks.dart';

void main() {
  late MockProfileRepository mockRepo;

  setUp(() {
    registerFallbacks();
    mockRepo = MockProfileRepository();
  });

  ProviderContainer makeContainer() {
    final container = ProviderContainer(
      overrides: [
        profileRepositoryProvider.overrideWith((ref) => mockRepo),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('LanguageEdit', () {
    test('starts as AsyncData(null)', () {
      final container = makeContainer();
      expect(
        container.read(languageEditProvider),
        equals(const AsyncData<void>(null)),
      );
    });

    test('save() calls repository with correct args and returns true', () async {
      when(
        () => mockRepo.updateLanguages(
          nativeLanguage: any(named: 'nativeLanguage'),
          uiLanguage: any(named: 'uiLanguage'),
          fluentLanguages: any(named: 'fluentLanguages'),
          learningLanguages: any(named: 'learningLanguages'),
        ),
      ).thenAnswer((_) async {});
      when(() => mockRepo.getProfile()).thenAnswer((_) async => makeProfile());

      final container = makeContainer();
      final result = await container.read(languageEditProvider.notifier).save(
            nativeLanguage: 'ko',
            uiLanguage: 'ko',
            fluentLanguages: ['en'],
            learningLanguages: ['ja', 'zh'],
          );

      expect(result, isTrue);
      verify(
        () => mockRepo.updateLanguages(
          nativeLanguage: 'ko',
          uiLanguage: 'ko',
          fluentLanguages: ['en'],
          learningLanguages: ['ja', 'zh'],
        ),
      ).called(1);
      // invalidate(userProfileProvider) triggers a re-fetch on next access
      expect(container.read(languageEditProvider).hasValue, isTrue);
    });

    test('save() returns false and exposes error on failure', () async {
      when(
        () => mockRepo.updateLanguages(
          nativeLanguage: any(named: 'nativeLanguage'),
          uiLanguage: any(named: 'uiLanguage'),
          fluentLanguages: any(named: 'fluentLanguages'),
          learningLanguages: any(named: 'learningLanguages'),
        ),
      ).thenThrow(Exception('network error'));

      final container = makeContainer();
      final result = await container.read(languageEditProvider.notifier).save(
            nativeLanguage: 'ko',
            uiLanguage: 'ko',
            fluentLanguages: ['en'],
            learningLanguages: ['ja'],
          );

      expect(result, isFalse);
      expect(container.read(languageEditProvider).hasError, isTrue);
    });

    test('save() resets to success state after repeated calls', () async {
      when(
        () => mockRepo.updateLanguages(
          nativeLanguage: any(named: 'nativeLanguage'),
          uiLanguage: any(named: 'uiLanguage'),
          fluentLanguages: any(named: 'fluentLanguages'),
          learningLanguages: any(named: 'learningLanguages'),
        ),
      ).thenAnswer((_) async {});
      when(() => mockRepo.getProfile()).thenAnswer((_) async => makeProfile());

      final container = makeContainer();
      await container.read(languageEditProvider.notifier).save(
            nativeLanguage: 'ko',
            uiLanguage: 'ko',
            fluentLanguages: ['en'],
            learningLanguages: ['ja'],
          );
      await container.read(languageEditProvider.notifier).save(
            nativeLanguage: 'ko',
            uiLanguage: 'ko',
            fluentLanguages: ['en', 'fr'],
            learningLanguages: ['ja'],
          );

      expect(container.read(languageEditProvider).hasValue, isTrue);
      verify(() => mockRepo.updateLanguages(
            nativeLanguage: any(named: 'nativeLanguage'),
            uiLanguage: any(named: 'uiLanguage'),
            fluentLanguages: any(named: 'fluentLanguages'),
            learningLanguages: any(named: 'learningLanguages'),
          )).called(2);
    });
  });
}
