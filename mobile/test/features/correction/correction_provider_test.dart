import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/features/correction/data/correction_repository_impl.dart';
import 'package:tonebridge/features/correction/domain/model/correction_item.dart';
import 'package:tonebridge/features/correction/presentation/correction_provider.dart';

import '../../helpers/mocks.dart';

void main() {
  late MockCorrectionRepository mockRepo;

  setUp(() {
    registerFallbacks();
    mockRepo = MockCorrectionRepository();
  });

  ProviderContainer makeContainer() {
    final container = ProviderContainer(
      overrides: [
        correctionRepositoryProvider.overrideWith((ref) => mockRepo),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('RatingState (parameterized by correctionId)', () {
    test('starts as AsyncData(null)', () {
      final container = makeContainer();
      final state = container.read(ratingStateProvider('cor-1'));
      expect(state, equals(const AsyncData<void>(null)));
    });

    test('rate(helpful:true) calls repository with correct args', () async {
      when(() => mockRepo.rateCorrection('cor-1', helpful: true))
          .thenAnswer((_) async {});

      final container = makeContainer();
      await container
          .read(ratingStateProvider('cor-1').notifier)
          .rate(helpful: true);

      verify(() => mockRepo.rateCorrection('cor-1', helpful: true)).called(1);
      expect(container.read(ratingStateProvider('cor-1')).hasValue, isTrue);
    });

    test('rate(helpful:false) calls repository with helpful=false', () async {
      when(() => mockRepo.rateCorrection('cor-2', helpful: false))
          .thenAnswer((_) async {});

      final container = makeContainer();
      await container
          .read(ratingStateProvider('cor-2').notifier)
          .rate(helpful: false);

      verify(() => mockRepo.rateCorrection('cor-2', helpful: false)).called(1);
    });

    test('different correctionIds are independent providers', () async {
      when(() => mockRepo.rateCorrection(any(), helpful: any(named: 'helpful')))
          .thenAnswer((_) async {});

      final container = makeContainer();

      // Rate cor-1 but not cor-2
      await container
          .read(ratingStateProvider('cor-1').notifier)
          .rate(helpful: true);

      // cor-2 should still be in initial state
      expect(container.read(ratingStateProvider('cor-2')).isLoading, isFalse);
      verifyNever(
          () => mockRepo.rateCorrection('cor-2', helpful: any(named: 'helpful')));
    });

    test('exposes error state when repository throws', () async {
      when(() => mockRepo.rateCorrection('cor-err', helpful: true))
          .thenThrow(Exception('server error'));

      final container = makeContainer();
      await container
          .read(ratingStateProvider('cor-err').notifier)
          .rate(helpful: true);

      expect(container.read(ratingStateProvider('cor-err')).hasError, isTrue);
    });
  });

  group('SubmitCorrectionState', () {
    test('starts as AsyncData(null)', () {
      final container = makeContainer();
      expect(
        container.read(submitCorrectionStateProvider),
        isA<AsyncData<CorrectionItem?>>(),
      );
    });

    test('submit() transitions through loading to data', () async {
      final correction = makeCorrection();
      when(
        () => mockRepo.submitCorrection(
          requestId: any(named: 'requestId'),
          explanation: any(named: 'explanation'),
          correctedText: any(named: 'correctedText'),
          tags: any(named: 'tags'),
          timestampComments: any(named: 'timestampComments'),
          pronunciationScore: any(named: 'pronunciationScore'),
          intonationScore: any(named: 'intonationScore'),
          fluencyScore: any(named: 'fluencyScore'),
          referenceAudioUrl: any(named: 'referenceAudioUrl'),
        ),
      ).thenAnswer((_) async => correction);

      final container = makeContainer();
      await container.read(submitCorrectionStateProvider.notifier).submit(
            requestId: 'req-1',
            explanation: 'Looks good',
          );

      final state = container.read(submitCorrectionStateProvider);
      expect(state.value, equals(correction));
    });

    test('submit() with audio scores passes them to repository (MEDIUM-8: isAudio flag)',
        () async {
      final correction = makeCorrection();
      when(
        () => mockRepo.submitCorrection(
          requestId: 'audio-req',
          explanation: any(named: 'explanation'),
          correctedText: any(named: 'correctedText'),
          tags: any(named: 'tags'),
          timestampComments: any(named: 'timestampComments'),
          pronunciationScore: 8,
          intonationScore: 7,
          fluencyScore: 9,
          referenceAudioUrl: any(named: 'referenceAudioUrl'),
        ),
      ).thenAnswer((_) async => correction);

      final container = makeContainer();
      await container.read(submitCorrectionStateProvider.notifier).submit(
            requestId: 'audio-req',
            explanation: 'Great pronunciation',
            pronunciationScore: 8,
            intonationScore: 7,
            fluencyScore: 9,
          );

      verify(
        () => mockRepo.submitCorrection(
          requestId: 'audio-req',
          explanation: 'Great pronunciation',
          correctedText: any(named: 'correctedText'),
          tags: any(named: 'tags'),
          timestampComments: any(named: 'timestampComments'),
          pronunciationScore: 8,
          intonationScore: 7,
          fluencyScore: 9,
          referenceAudioUrl: any(named: 'referenceAudioUrl'),
        ),
      ).called(1);
    });

    test('submit() with text request passes null scores (MEDIUM-8: isAudio=false)',
        () async {
      final correction = makeCorrection();
      when(
        () => mockRepo.submitCorrection(
          requestId: any(named: 'requestId'),
          explanation: any(named: 'explanation'),
          correctedText: any(named: 'correctedText'),
          tags: any(named: 'tags'),
          timestampComments: any(named: 'timestampComments'),
          pronunciationScore: null,
          intonationScore: null,
          fluencyScore: null,
          referenceAudioUrl: any(named: 'referenceAudioUrl'),
        ),
      ).thenAnswer((_) async => correction);

      final container = makeContainer();
      await container.read(submitCorrectionStateProvider.notifier).submit(
            requestId: 'text-req',
            explanation: 'Looks good',
            correctedText: 'Hello there',
            // No scores for text request
          );

      verify(
        () => mockRepo.submitCorrection(
          requestId: 'text-req',
          explanation: 'Looks good',
          correctedText: 'Hello there',
          tags: any(named: 'tags'),
          timestampComments: any(named: 'timestampComments'),
          pronunciationScore: null,
          intonationScore: null,
          fluencyScore: null,
          referenceAudioUrl: any(named: 'referenceAudioUrl'),
        ),
      ).called(1);
    });

    test('submit() with timestampComments maps them correctly (H-1 data model)',
        () async {
      final correction = makeCorrection();
      when(
        () => mockRepo.submitCorrection(
          requestId: any(named: 'requestId'),
          explanation: any(named: 'explanation'),
          correctedText: any(named: 'correctedText'),
          tags: any(named: 'tags'),
          timestampComments: any(named: 'timestampComments'),
          pronunciationScore: any(named: 'pronunciationScore'),
          intonationScore: any(named: 'intonationScore'),
          fluencyScore: any(named: 'fluencyScore'),
          referenceAudioUrl: any(named: 'referenceAudioUrl'),
        ),
      ).thenAnswer((_) async => correction);

      final container = makeContainer();
      await container.read(submitCorrectionStateProvider.notifier).submit(
            requestId: 'req-ts',
            explanation: 'See timestamps',
            timestampComments: [
              TimestampCommentInput(
                  offsetMs: 1500, comment: '발음 부정확', category: '발음'),
              TimestampCommentInput(
                  offsetMs: 3000, comment: '억양 이상', category: '억양'),
            ],
          );

      final captured = verify(
        () => mockRepo.submitCorrection(
          requestId: any(named: 'requestId'),
          explanation: any(named: 'explanation'),
          correctedText: any(named: 'correctedText'),
          tags: any(named: 'tags'),
          timestampComments: captureAny(named: 'timestampComments'),
          pronunciationScore: any(named: 'pronunciationScore'),
          intonationScore: any(named: 'intonationScore'),
          fluencyScore: any(named: 'fluencyScore'),
          referenceAudioUrl: any(named: 'referenceAudioUrl'),
        ),
      ).captured;

      final tsList = captured.first as List<TimestampComment>;
      expect(tsList, hasLength(2));
      expect(tsList[0].offsetMs, 1500);
      expect(tsList[0].category, '발음');
      expect(tsList[1].offsetMs, 3000);
      expect(tsList[1].category, '억양');
    });

    test('submit() exposes error when repository throws (H-5: await chain)',
        () async {
      when(
        () => mockRepo.submitCorrection(
          requestId: any(named: 'requestId'),
          explanation: any(named: 'explanation'),
          correctedText: any(named: 'correctedText'),
          tags: any(named: 'tags'),
          timestampComments: any(named: 'timestampComments'),
          pronunciationScore: any(named: 'pronunciationScore'),
          intonationScore: any(named: 'intonationScore'),
          fluencyScore: any(named: 'fluencyScore'),
          referenceAudioUrl: any(named: 'referenceAudioUrl'),
        ),
      ).thenThrow(Exception('server 500'));

      final container = makeContainer();
      await container.read(submitCorrectionStateProvider.notifier).submit(
            requestId: 'req-fail',
            explanation: 'Test explanation',
          );

      // After awaiting, state must be error — not loading (H-5: no early return on error)
      final state = container.read(submitCorrectionStateProvider);
      expect(state.hasError, isTrue);
      expect(state.isLoading, isFalse);
    });

    test('reset() returns state to AsyncData(null)', () async {
      final correction = makeCorrection();
      when(
        () => mockRepo.submitCorrection(
          requestId: any(named: 'requestId'),
          explanation: any(named: 'explanation'),
          correctedText: any(named: 'correctedText'),
          tags: any(named: 'tags'),
          timestampComments: any(named: 'timestampComments'),
          pronunciationScore: any(named: 'pronunciationScore'),
          intonationScore: any(named: 'intonationScore'),
          fluencyScore: any(named: 'fluencyScore'),
          referenceAudioUrl: any(named: 'referenceAudioUrl'),
        ),
      ).thenAnswer((_) async => correction);

      final container = makeContainer();
      await container.read(submitCorrectionStateProvider.notifier).submit(
            requestId: 'req-1',
            explanation: 'Looks good',
          );
      container.read(submitCorrectionStateProvider.notifier).reset();

      expect(
        container.read(submitCorrectionStateProvider),
        isA<AsyncData<CorrectionItem?>>(),
      );
      expect(container.read(submitCorrectionStateProvider).value, isNull);
    });
  });
}
