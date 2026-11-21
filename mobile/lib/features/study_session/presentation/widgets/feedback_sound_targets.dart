import 'package:flutter/material.dart';

import '../../domain/model/sound_target.dart';
import '../../domain/sound_guides.dart';
import 'sound_guide_diagram.dart';

/// Sounds a friend pointed out in feedback, shown as collapsible guides and kept
/// visibly apart from the friend's own words. Unknown ids (a retired guide) are skipped.
class FeedbackSoundTargets extends StatelessWidget {
  const FeedbackSoundTargets({required this.targets, super.key});

  final List<SoundTarget> targets;

  @override
  Widget build(BuildContext context) {
    final guides = [
      for (final target in targets) ?soundGuideById(target.guideId),
    ];
    if (guides.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text('피드백에서 짚은 소리', style: theme.textTheme.labelLarge),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: theme.colorScheme.tertiaryContainer,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '베타',
                style: TextStyle(
                  fontSize: 12,
                  color: theme.colorScheme.onTertiaryContainer,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          '그림과 설명은 아직 검수 중이에요. 참고용으로 봐 주세요.',
          style: TextStyle(fontSize: 12, color: theme.colorScheme.outline),
        ),
        for (final guide in guides)
          _GuideTile(key: ValueKey(guide.id), guide: guide),
      ],
    );
  }
}

class _GuideTile extends StatelessWidget {
  const _GuideTile({required this.guide, super.key});

  final SoundGuide guide;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(top: 8),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        minTileHeight: 48,
        leading: SizedBox(
          width: 28,
          child: Text(
            guide.symbol,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: theme.colorScheme.primary,
            ),
          ),
        ),
        title: Text(guide.title),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 240),
            child: SoundGuideDiagram(guide: guide),
          ),
          const SizedBox(height: 12),
          for (final (index, step) in guide.steps.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text('${index + 1}. $step'),
            ),
          const SizedBox(height: 4),
          Text(
            '${contactLabel(guide.contactKind)} · 점선: 쉴 때의 혀',
            style: TextStyle(fontSize: 12, color: theme.colorScheme.outline),
          ),
        ],
      ),
    );
  }
}
