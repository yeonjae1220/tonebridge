import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/features/correction/domain/model/correction_item.dart';
import 'package:tonebridge/features/correction/presentation/correction_provider.dart';

class ResultPage extends ConsumerWidget {
  const ResultPage({super.key, required this.requestId});
  final String requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resultAsync = ref.watch(correctionResultProvider(requestId));
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('교정 결과')),
      body: resultAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline_rounded,
                  size: 48, color: theme.colorScheme.error),
              const SizedBox(height: 12),
              Text('결과를 불러올 수 없습니다', style: theme.textTheme.titleMedium),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () =>
                    ref.invalidate(correctionResultProvider(requestId)),
                child: const Text('다시 시도'),
              ),
            ],
          ),
        ),
        data: (corrections) {
          if (corrections.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.hourglass_top_rounded,
                      size: 56, color: theme.colorScheme.outline),
                  const SizedBox(height: 16),
                  Text(
                    '아직 교정 결과가 없습니다.\n교정자가 답변을 준비 중입니다.',
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color:
                          theme.colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: corrections.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) => _CorrectionCard(
              correction: corrections[index],
            ),
          );
        },
      ),
    );
  }
}

class _CorrectionCard extends ConsumerWidget {
  const _CorrectionCard({required this.correction});
  final CorrectionItem correction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final ratingAsync = ref.watch(ratingStateProvider(correction.id));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (correction.isAi)
                  _Badge(
                    label: 'AI 교정',
                    color: theme.colorScheme.tertiaryContainer,
                    textColor: theme.colorScheme.onTertiaryContainer,
                  )
                else
                  _Badge(
                    label: '사람 교정',
                    color: theme.colorScheme.primaryContainer,
                    textColor: theme.colorScheme.onPrimaryContainer,
                  ),
                const Spacer(),
                _StatusBadge(status: correction.status),
              ],
            ),
            if (correction.correctedText != null) ...[
              const SizedBox(height: 12),
              Text('교정된 표현',
                  style: theme.textTheme.labelMedium
                      ?.copyWith(color: theme.colorScheme.outline)),
              const SizedBox(height: 4),
              Text(correction.correctedText!,
                  style: theme.textTheme.bodyMedium),
            ],
            if (correction.explanation?.isNotEmpty ?? false) ...[
              const SizedBox(height: 12),
              Text('설명',
                  style: theme.textTheme.labelMedium
                      ?.copyWith(color: theme.colorScheme.outline)),
              const SizedBox(height: 4),
              Text(correction.explanation!, style: theme.textTheme.bodyMedium),
            ],
            if (_hasScores(correction)) ...[
              const SizedBox(height: 12),
              _ScoreRow(
                pronunciation: correction.pronunciationScore,
                intonation: correction.intonationScore,
                fluency: correction.fluencyScore,
              ),
            ],
            if (correction.tags.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                children: correction.tags
                    .map((t) => Chip(
                          label: Text(t),
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                          visualDensity: VisualDensity.compact,
                        ))
                    .toList(),
              ),
            ],
            if (correction.status == 'APPROVED') ...[
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('이 교정이 도움이 됐나요?',
                      style: theme.textTheme.bodySmall),
                  const SizedBox(width: 12),
                  IconButton.filledTonal(
                    onPressed: ratingAsync.isLoading
                        ? null
                        : () => ref
                            .read(ratingStateProvider(correction.id).notifier)
                            .rate(helpful: true),
                    icon: const Icon(Icons.thumb_up_rounded, size: 20),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filledTonal(
                    onPressed: ratingAsync.isLoading
                        ? null
                        : () => ref
                            .read(ratingStateProvider(correction.id).notifier)
                            .rate(helpful: false),
                    icon: const Icon(Icons.thumb_down_rounded, size: 20),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  bool _hasScores(CorrectionItem c) =>
      c.pronunciationScore != null ||
      c.intonationScore != null ||
      c.fluencyScore != null;
}

class _Badge extends StatelessWidget {
  const _Badge(
      {required this.label,
      required this.color,
      required this.textColor});
  final String label;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: Theme.of(context)
              .textTheme
              .labelSmall
              ?.copyWith(color: textColor, fontWeight: FontWeight.w600),
        ),
      );
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (label, color) = switch (status) {
      'APPROVED' => ('승인됨', theme.colorScheme.primary),
      'REJECTED' => ('반려됨', theme.colorScheme.error),
      _ => ('검토중', theme.colorScheme.outline),
    };
    return Text(
      label,
      style:
          theme.textTheme.labelSmall?.copyWith(color: color),
    );
  }
}

class _ScoreRow extends StatelessWidget {
  const _ScoreRow({this.pronunciation, this.intonation, this.fluency});
  final int? pronunciation;
  final int? intonation;
  final int? fluency;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        if (pronunciation != null)
          _ScoreItem(label: '발음', score: pronunciation!, theme: theme),
        if (intonation != null)
          _ScoreItem(label: '억양', score: intonation!, theme: theme),
        if (fluency != null)
          _ScoreItem(label: '유창성', score: fluency!, theme: theme),
      ],
    );
  }
}

class _ScoreItem extends StatelessWidget {
  const _ScoreItem(
      {required this.label, required this.score, required this.theme});
  final String label;
  final int score;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(right: 16),
        child: Column(
          children: [
            Text('$score/10',
                style: theme.textTheme.titleMedium
                    ?.copyWith(color: theme.colorScheme.primary,
                        fontWeight: FontWeight.bold)),
            Text(label, style: theme.textTheme.labelSmall),
          ],
        ),
      );
}
