import 'package:flutter/material.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';

class CorrectionRequestCard extends StatelessWidget {
  const CorrectionRequestCard({
    super.key,
    required this.item,
    required this.onTap,
    this.isVariantMatch = false,
  });

  final CorrectionRequestItem item;
  final VoidCallback onTap;
  final bool isVariantMatch;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isAudio = item.type == 'AUDIO';

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      shape: isVariantMatch
          ? RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                  color: theme.colorScheme.primary.withValues(alpha: 0.5),
                  width: 1.5),
            )
          : null,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _LanguageBadge(
                    language: item.targetLanguage,
                    variant: item.targetVariant,
                  ),
                  const SizedBox(width: 8),
                  _TypeBadge(isAudio: isAudio),
                  const Spacer(),
                  _CreditChip(credits: item.creditCost),
                ],
              ),
              const SizedBox(height: 10),
              if (isAudio)
                Row(
                  children: [
                    Icon(
                      Icons.mic_rounded,
                      size: 16,
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '음성 교정 요청',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurface
                            .withValues(alpha: 0.7),
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                )
              else
                Text(
                  item.contentText ?? '',
                  style: theme.textTheme.bodyMedium,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              if (item.context != null && item.context!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  item.context!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.55),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              if (item.feedbackGoals.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: item.feedbackGoals
                      .map((g) => _GoalChip(label: g))
                      .toList(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _LanguageBadge extends StatelessWidget {
  const _LanguageBadge({required this.language, this.variant});
  final String language;
  final String? variant;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final label = variant != null && variant!.isNotEmpty
        ? '$language · $variant'
        : language;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.onPrimaryContainer,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  const _TypeBadge({required this.isAudio});
  final bool isAudio;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isAudio
            ? theme.colorScheme.tertiaryContainer
            : theme.colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        isAudio ? '음성' : '텍스트',
        style: theme.textTheme.labelSmall?.copyWith(
          color: isAudio
              ? theme.colorScheme.onTertiaryContainer
              : theme.colorScheme.onSecondaryContainer,
        ),
      ),
    );
  }
}

class _CreditChip extends StatelessWidget {
  const _CreditChip({required this.credits});
  final int credits;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.toll_rounded, size: 16, color: theme.colorScheme.primary),
        const SizedBox(width: 3),
        Text(
          '+$credits',
          style: theme.textTheme.labelMedium?.copyWith(
            color: theme.colorScheme.primary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
}

class _GoalChip extends StatelessWidget {
  const _GoalChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.4),
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
        ),
      ),
    );
  }
}
