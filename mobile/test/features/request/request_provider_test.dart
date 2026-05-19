import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';
import 'package:tonebridge/features/request/data/request_repository_impl.dart';
import 'package:tonebridge/features/request/presentation/request_provider.dart';

import '../../helpers/mocks.dart';

void main() {
  late MockRequestRepository mockRepo;

  setUp(() {
    registerFallbacks();
    mockRepo = MockRequestRepository();
  });

  ProviderContainer makeContainer() {
    final container = ProviderContainer(
      overrides: [
        requestRepositoryProvider.overrideWith((ref) => mockRepo),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('RequestState', () {
    test('starts as AsyncData(null)', () {
      final container = makeContainer();
      expect(
        container.read(requestStateProvider),
        isA<AsyncData<CorrectionRequestItem?>>(),
      );
    });

    test('submitText() succeeds and sets state to the returned item', () async {
      final item = makeRequest(id: 'new-req');
      when(
        () => mockRepo.submitTextRequest(
          targetLanguage: any(named: 'targetLanguage'),
          contentText: any(named: 'contentText'),
          targetVariant: any(named: 'targetVariant'),
          context: any(named: 'context'),
          feedbackGoals: any(named: 'feedbackGoals'),
        ),
      ).thenAnswer((_) async => item);

      final container = makeContainer();
      await container.read(requestStateProvider.notifier).submitText(
            targetLanguage: 'en',
            contentText: 'Hello world',
          );

      expect(container.read(requestStateProvider).value, equals(item));
    });

    test('submitText() exposes error on failure', () async {
      when(
        () => mockRepo.submitTextRequest(
          targetLanguage: any(named: 'targetLanguage'),
          contentText: any(named: 'contentText'),
          targetVariant: any(named: 'targetVariant'),
          context: any(named: 'context'),
          feedbackGoals: any(named: 'feedbackGoals'),
        ),
      ).thenThrow(Exception('insufficient credits'));

      final container = makeContainer();
      await container.read(requestStateProvider.notifier).submitText(
            targetLanguage: 'en',
            contentText: 'Hello world',
          );

      expect(container.read(requestStateProvider).hasError, isTrue);
    });

    test('reset() clears state back to AsyncData(null)', () async {
      final item = makeRequest();
      when(
        () => mockRepo.submitTextRequest(
          targetLanguage: any(named: 'targetLanguage'),
          contentText: any(named: 'contentText'),
          targetVariant: any(named: 'targetVariant'),
          context: any(named: 'context'),
          feedbackGoals: any(named: 'feedbackGoals'),
        ),
      ).thenAnswer((_) async => item);

      final container = makeContainer();
      await container.read(requestStateProvider.notifier).submitText(
            targetLanguage: 'en',
            contentText: 'test',
          );
      container.read(requestStateProvider.notifier).reset();

      expect(
        container.read(requestStateProvider),
        isA<AsyncData<CorrectionRequestItem?>>(),
      );
    });

    test('passes feedbackGoals to repository', () async {
      final item = makeRequest();
      when(
        () => mockRepo.submitTextRequest(
          targetLanguage: 'ja',
          contentText: 'こんにちは',
          targetVariant: null,
          context: null,
          feedbackGoals: ['pronunciation', 'intonation'],
        ),
      ).thenAnswer((_) async => item);

      final container = makeContainer();
      await container.read(requestStateProvider.notifier).submitText(
            targetLanguage: 'ja',
            contentText: 'こんにちは',
            feedbackGoals: ['pronunciation', 'intonation'],
          );

      verify(
        () => mockRepo.submitTextRequest(
          targetLanguage: 'ja',
          contentText: 'こんにちは',
          targetVariant: null,
          context: null,
          feedbackGoals: ['pronunciation', 'intonation'],
        ),
      ).called(1);
    });
  });
}
