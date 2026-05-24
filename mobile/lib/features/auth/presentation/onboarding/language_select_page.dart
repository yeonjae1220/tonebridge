import 'package:flutter/material.dart';
import 'package:tonebridge/core/constants/languages.dart';
import 'package:tonebridge/core/widgets/language_picker/other_languages_sheet.dart';

class LanguageSelectPage extends StatefulWidget {
  const LanguageSelectPage({
    required this.title,
    required this.subtitle,
    required this.singleSelect,
    required this.onChanged,
    required this.onNext,
    this.initialValues = const [],
    this.nextLabel = '다음',
    this.isLoading = false,
    super.key,
  });

  final String title;
  final String subtitle;
  final bool singleSelect;
  final ValueChanged<List<String>> onChanged;
  final VoidCallback onNext;
  final List<String> initialValues;
  final String nextLabel;
  final bool isLoading;

  @override
  State<LanguageSelectPage> createState() => _LanguageSelectPageState();
}

class _LanguageSelectPageState extends State<LanguageSelectPage> {
  Set<String> _selected = {};

  @override
  void initState() {
    super.initState();
    _selected = Set.of(widget.initialValues);
  }

  void _toggle(String code) {
    final next = widget.singleSelect
        ? {code}
        : (_selected.contains(code)
            ? (_selected.toSet()..remove(code))
            : {..._selected, code});
    setState(() => _selected = next);
    widget.onChanged(next.toList());
  }

  Future<void> _showOther() async {
    final picked = await showOtherLanguagesSheet(context);
    if (picked == null || !mounted) return;
    _toggle(picked.code);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canProceed = _selected.isNotEmpty;

    // Codes selected from kOtherLanguages (not in primary grid)
    final otherSelected = _selected
        .where((code) => !kPrimaryLanguages.any((l) => l.code == code))
        .toList();

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
              color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: 24),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // 3×3 primary language grid (kPrimaryLanguages = 9 items)
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      mainAxisExtent: 90,
                    ),
                    itemCount: kPrimaryLanguages.length,
                    itemBuilder: (context, index) {
                      final lang = kPrimaryLanguages[index];
                      return _LanguageGridCell(
                        lang: lang,
                        isSelected: _selected.contains(lang.code),
                        onTap: () => _toggle(lang.code),
                      );
                    },
                  ),
                  // Selected "other" languages shown as dismissible chips
                  if (otherSelected.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: otherSelected.map((code) {
                        final lang = kOtherLanguages
                            .where((l) => l.code == code)
                            .firstOrNull;
                        if (lang == null) return const SizedBox.shrink();
                        return Chip(
                          avatar: Text(
                            lang.flag,
                            style: const TextStyle(fontSize: 16),
                          ),
                          label: Text(lang.label),
                          deleteIcon: const Icon(Icons.close, size: 16),
                          onDeleted: () => _toggle(code),
                        );
                      }).toList(),
                    ),
                  ],
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _showOther,
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('기타 언어'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
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

class _LanguageGridCell extends StatelessWidget {
  const _LanguageGridCell({
    required this.lang,
    required this.isSelected,
    required this.onTap,
  });

  final LanguageEntry lang;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: isSelected ? theme.colorScheme.primaryContainer : null,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? theme.colorScheme.primary
                : theme.colorScheme.outline.withValues(alpha: 0.3),
            width: isSelected ? 2.0 : 1.0,
          ),
        ),
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(lang.flag, style: const TextStyle(fontSize: 26)),
                  const SizedBox(height: 6),
                  Text(
                    lang.label,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: isSelected
                          ? theme.colorScheme.onPrimaryContainer
                          : theme.colorScheme.onSurface,
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.normal,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (isSelected)
              Positioned(
                top: 6,
                right: 6,
                child: Icon(
                  Icons.check_circle,
                  size: 16,
                  color: theme.colorScheme.primary,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
