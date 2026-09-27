import 'package:flutter_test/flutter_test.dart';
import 'package:tonebridge/features/correction/presentation/correction_provider.dart';

void main() {
  group('TimestampCommentInput', () {
    test('toModel() maps all fields correctly', () {
      const input = TimestampCommentInput(
        offsetMs: 2500,
        comment: '발음이 부정확합니다',
        category: '발음',
      );

      final model = input.toModel();

      expect(model.offsetMs, 2500);
      expect(model.comment, '발음이 부정확합니다');
      expect(model.category, '발음');
    });

    test('toModel() preserves zero offsetMs', () {
      const input =
          TimestampCommentInput(offsetMs: 0, comment: '시작 부분', category: '강세');

      expect(input.toModel().offsetMs, 0);
    });

    test('toModel() preserves empty category string', () {
      const input = TimestampCommentInput(
          offsetMs: 100, comment: 'no category', category: '');

      expect(input.toModel().category, '');
    });

    test('list of inputs maps to list of models in order', () {
      final inputs = [
        const TimestampCommentInput(offsetMs: 1000, comment: 'a', category: '발음'),
        const TimestampCommentInput(offsetMs: 2000, comment: 'b', category: '억양'),
        const TimestampCommentInput(offsetMs: 3000, comment: 'c', category: '속도'),
      ];

      final models = inputs.map((i) => i.toModel()).toList();

      expect(models, hasLength(3));
      for (var i = 0; i < models.length; i++) {
        expect(models[i].offsetMs, inputs[i].offsetMs);
        expect(models[i].comment, inputs[i].comment);
        expect(models[i].category, inputs[i].category);
      }
    });
  });
}
