import 'package:flutter/material.dart';

class SpeedDialFab extends StatelessWidget {
  const SpeedDialFab({
    super.key,
    required this.expanded,
    required this.onToggle,
    required this.onTextCard,
    required this.onVoiceCard,
  });

  final bool expanded;
  final VoidCallback onToggle;
  final VoidCallback onTextCard;
  final VoidCallback onVoiceCard;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        AnimatedOpacity(
          opacity: expanded ? 1.0 : 0.0,
          duration: const Duration(milliseconds: 180),
          child: AnimatedSlide(
            offset: expanded ? Offset.zero : const Offset(0, 0.25),
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            child: IgnorePointer(
              ignoring: !expanded,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  _MiniFab(
                    icon: Icons.mic_rounded,
                    label: '음성',
                    onTap: onVoiceCard,
                  ),
                  const SizedBox(height: 10),
                  _MiniFab(
                    icon: Icons.text_fields_rounded,
                    label: '텍스트',
                    onTap: onTextCard,
                  ),
                  const SizedBox(height: 14),
                ],
              ),
            ),
          ),
        ),
        FloatingActionButton(
          onPressed: onToggle,
          tooltip: '카드 추가',
          child: AnimatedRotation(
            turns: expanded ? 0.125 : 0,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeInOut,
            child: const Icon(Icons.add_rounded),
          ),
        ),
      ],
    );
  }
}

class _MiniFab extends StatelessWidget {
  const _MiniFab({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Card(
          elevation: 2,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: theme.colorScheme.onSurface,
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        FloatingActionButton.small(
          heroTag: label,
          onPressed: onTap,
          child: Icon(icon),
        ),
      ],
    );
  }
}
