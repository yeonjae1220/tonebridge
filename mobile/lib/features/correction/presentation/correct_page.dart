import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/features/correction/presentation/correction_provider.dart';

class CorrectPage extends ConsumerStatefulWidget {
  const CorrectPage({super.key, required this.requestId});
  final String requestId;

  @override
  ConsumerState<CorrectPage> createState() => _CorrectPageState();
}

class _CorrectPageState extends ConsumerState<CorrectPage> {
  final _formKey = GlobalKey<FormState>();
  final _correctedTextController = TextEditingController();
  final _explanationController = TextEditingController();

  int? _pronunciationScore;
  int? _intonationScore;
  int? _fluencyScore;
  final List<String> _tags = [];

  static const _tagOptions = [
    '문법', '어휘', '발음', '억양', '자연스러움', '격식',
  ];

  @override
  void dispose() {
    _correctedTextController.dispose();
    _explanationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final submitAsync = ref.watch(submitCorrectionStateProvider);
    final isLoading = submitAsync.isLoading;

    ref.listen(submitCorrectionStateProvider, (previous, next) {
      if (next.hasError && !(previous?.hasError ?? false) && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('교정 제출에 실패했습니다.'),
            backgroundColor: theme.colorScheme.error,
          ),
        );
      }
      if (next.hasValue && next.value != null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('교정이 제출됐습니다!')),
        );
        ref.read(submitCorrectionStateProvider.notifier).reset();
        if (!mounted) return;
        context.go(AppRoute.feed);
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text('교정 작성')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _RequestPreview(requestId: widget.requestId),
            const SizedBox(height: 24),
            const _SectionLabel(label: '교정 내용'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _correctedTextController,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: '올바른 표현으로 수정해주세요 (텍스트 요청인 경우)',
              ),
            ),
            const SizedBox(height: 24),
            const _SectionLabel(label: '설명 *'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _explanationController,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: '교정 이유나 설명을 입력해주세요',
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return '설명을 입력해주세요';
                return null;
              },
            ),
            const SizedBox(height: 24),
            const _SectionLabel(label: '발음 점수 (음성 요청인 경우)'),
            const SizedBox(height: 8),
            _ScoreRow(
              label: '발음',
              value: _pronunciationScore,
              onChanged: (v) => setState(() => _pronunciationScore = v),
            ),
            _ScoreRow(
              label: '억양',
              value: _intonationScore,
              onChanged: (v) => setState(() => _intonationScore = v),
            ),
            _ScoreRow(
              label: '유창성',
              value: _fluencyScore,
              onChanged: (v) => setState(() => _fluencyScore = v),
            ),
            const SizedBox(height: 24),
            const _SectionLabel(label: '태그 (선택)'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _tagOptions.map((t) {
                final selected = _tags.contains(t);
                return FilterChip(
                  label: Text(t),
                  selected: selected,
                  onSelected: (v) => setState(() {
                    if (v) {
                      _tags.add(t);
                    } else {
                      _tags.remove(t);
                    }
                  }),
                );
              }).toList(),
            ),
            const SizedBox(height: 32),
            FilledButton(
              onPressed: isLoading ? null : _submit,
              child: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('교정 제출'),
            ),
          ],
        ),
      ),
    );
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    ref.read(submitCorrectionStateProvider.notifier).submit(
          requestId: widget.requestId,
          correctedText: _correctedTextController.text.trim().isEmpty
              ? null
              : _correctedTextController.text.trim(),
          explanation: _explanationController.text.trim(),
          tags: List.from(_tags),
          pronunciationScore: _pronunciationScore,
          intonationScore: _intonationScore,
          fluencyScore: _fluencyScore,
        );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Text(
        label,
        style: Theme.of(context)
            .textTheme
            .titleSmall
            ?.copyWith(fontWeight: FontWeight.w600),
      );
}

class _RequestPreview extends ConsumerWidget {
  const _RequestPreview({required this.requestId});
  final String requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('요청 ID: $requestId',
              style: theme.textTheme.labelSmall
                  ?.copyWith(color: theme.colorScheme.outline)),
          const SizedBox(height: 4),
          Text('피드에서 원문을 확인하세요',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.7))),
        ],
      ),
    );
  }
}

class _ScoreRow extends StatelessWidget {
  const _ScoreRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });
  final String label;
  final int? value;
  final ValueChanged<int?> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 52,
            child: Text(label, style: theme.textTheme.bodySmall),
          ),
          Expanded(
            child: Wrap(
              spacing: 4,
              children: List.generate(10, (i) {
                final score = i + 1;
                final selected = value == score;
                return GestureDetector(
                  onTap: () => onChanged(selected ? null : score),
                  child: Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: selected
                          ? theme.colorScheme.primary
                          : theme.colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '$score',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: selected
                            ? theme.colorScheme.onPrimary
                            : theme.colorScheme.onSurface,
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}
