import 'package:flutter/material.dart';

/// Supported languages. Extend as the platform grows.
const List<({String code, String label, String flag})> kSupportedLanguages = [
  (code: 'ko', label: '한국어', flag: '🇰🇷'),
  (code: 'ja', label: '日本語', flag: '🇯🇵'),
  (code: 'zh', label: '中文', flag: '🇨🇳'),
  (code: 'en', label: 'English', flag: '🇺🇸'),
  (code: 'es', label: 'Español', flag: '🇪🇸'),
  (code: 'fr', label: 'Français', flag: '🇫🇷'),
  (code: 'de', label: 'Deutsch', flag: '🇩🇪'),
  (code: 'pt', label: 'Português', flag: '🇧🇷'),
];

class LanguageSelectPage extends StatefulWidget {
  const LanguageSelectPage({
    required this.title,
    required this.subtitle,
    required this.singleSelect,
    required this.onChanged,
    required this.onNext,
    this.nextLabel = '다음',
    this.isLoading = false,
    super.key,
  });

  final String title;
  final String subtitle;
  final bool singleSelect;
  final ValueChanged<List<String>> onChanged;
  final VoidCallback onNext;
  final String nextLabel;
  final bool isLoading;

  @override
  State<LanguageSelectPage> createState() => _LanguageSelectPageState();
}

class _LanguageSelectPageState extends State<LanguageSelectPage> {
  final Set<String> _selected = {};

  void _toggle(String code) {
    setState(() {
      if (widget.singleSelect) {
        _selected
          ..clear()
          ..add(code);
      } else {
        if (_selected.contains(code)) {
          _selected.remove(code);
        } else {
          _selected.add(code);
        }
      }
    });
    widget.onChanged(_selected.toList());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canProceed = _selected.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.title, style: theme.textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(
            widget.subtitle,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha:0.6),
            ),
          ),
          const SizedBox(height: 24),
          Expanded(
            child: ListView.separated(
              itemCount: kSupportedLanguages.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final lang = kSupportedLanguages[index];
                final isSelected = _selected.contains(lang.code);
                return ListTile(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(
                      color: isSelected
                          ? theme.colorScheme.primary
                          : theme.colorScheme.outline.withValues(alpha:0.3),
                    ),
                  ),
                  tileColor: isSelected
                      ? theme.colorScheme.primaryContainer
                      : null,
                  leading: Text(
                    lang.flag,
                    style: const TextStyle(fontSize: 28),
                  ),
                  title: Text(lang.label),
                  trailing: isSelected
                      ? Icon(
                          Icons.check_circle,
                          color: theme.colorScheme.primary,
                        )
                      : null,
                  onTap: () => _toggle(lang.code),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: (canProceed && !widget.isLoading) ? widget.onNext : null,
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: widget.isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(widget.nextLabel),
          ),
        ],
      ),
    );
  }
}
