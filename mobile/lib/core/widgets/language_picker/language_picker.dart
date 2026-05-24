import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/constants/languages.dart';
import 'package:tonebridge/core/providers/language_variants_provider.dart';
import 'package:tonebridge/core/widgets/language_picker/dialect_bottom_sheet.dart';
import 'package:tonebridge/core/widgets/language_picker/other_languages_sheet.dart';

/// Inline language picker.
///
/// Single-select: provide [value] + [onChanged].
/// Multi-select:  provide [values] + [onMultiChanged] + set [multiSelect] = true.
/// Dialect:       [showDialect] = true (default) shows a sub-row for variant selection.
class LanguagePicker extends StatelessWidget {
  /// Single-select mode
  const LanguagePicker({
    required this.value,
    required this.onChanged,
    super.key,
    this.variant,
    this.onVariantChanged,
    this.showDialect = true,
    this.excludeCodes = const [],
  })  : multiSelect = false,
        values = const [],
        onMultiChanged = null;

  /// Multi-select mode
  const LanguagePicker.multi({
    required this.values,
    required this.onMultiChanged,
    super.key,
    this.excludeCodes = const [],
  })  : multiSelect = true,
        value = '',
        variant = null,
        onVariantChanged = null,
        showDialect = false,
        onChanged = null;

  final bool multiSelect;

  // Single-select fields
  final String value;
  final ValueChanged<String>? onChanged;
  final String? variant;
  final ValueChanged<String?>? onVariantChanged;
  final bool showDialect;

  // Multi-select fields
  final List<String> values;
  final ValueChanged<List<String>>? onMultiChanged;

  final List<String> excludeCodes;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PrimaryGrid(
          multiSelect: multiSelect,
          selectedCode: multiSelect ? null : value,
          selectedCodes: multiSelect ? values : null,
          excludeCodes: excludeCodes,
          onTap: (code) => _handleTap(context, code),
        ),
        const SizedBox(height: 8),
        _MoreButton(onTap: () => _showOther(context)),
        if (!multiSelect && value.isNotEmpty && showDialect) ...[
          const SizedBox(height: 12),
          _DialectRow(
            languageCode: value,
            variant: variant,
            onTap: () => _showDialect(context, languageCode: value),
          ),
        ],
      ],
    );
  }

  void _handleTap(BuildContext context, String code) {
    if (multiSelect) {
      final current = List<String>.from(values);
      if (current.contains(code)) {
        current.remove(code);
      } else {
        current.add(code);
      }
      onMultiChanged!(current);
    } else {
      onChanged!(code);
      if (onVariantChanged != null) onVariantChanged!(null);
      if (showDialect) {
        _showDialect(context, languageCode: code);
      }
    }
  }

  Future<void> _showOther(BuildContext context) async {
    final picked = await showOtherLanguagesSheet(
      context,
      excludeCodes: excludeCodes,
    );
    if (picked == null) return;
    if (multiSelect) {
      if (!values.contains(picked.code)) {
        onMultiChanged!([...values, picked.code]);
      }
    } else {
      onChanged!(picked.code);
      if (onVariantChanged != null) onVariantChanged!(null);
      if (showDialect && context.mounted) {
        _showDialect(context, languageCode: picked.code);
      }
    }
  }

  Future<void> _showDialect(
    BuildContext context, {
    required String languageCode,
  }) async {
    if (languageCode.isEmpty) return;
    final result = await showDialectBottomSheet(
      context,
      languageCode: languageCode,
      selectedVariant: languageCode == value ? variant : null,
    );
    // null return means "표준어" was selected; dismissed returns existing variant
    if (onVariantChanged != null) onVariantChanged!(result);
  }
}

class _PrimaryGrid extends StatelessWidget {
  const _PrimaryGrid({
    required this.multiSelect,
    required this.selectedCode,
    required this.selectedCodes,
    required this.excludeCodes,
    required this.onTap,
  });

  final bool multiSelect;
  final String? selectedCode;
  final List<String>? selectedCodes;
  final List<String> excludeCodes;
  final ValueChanged<String> onTap;

  bool _isSelected(String code) => multiSelect
      ? (selectedCodes?.contains(code) ?? false)
      : selectedCode == code;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final langs =
        kPrimaryLanguages.where((l) => !excludeCodes.contains(l.code)).toList();

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: langs.map((lang) {
        final selected = _isSelected(lang.code);
        return GestureDetector(
          onTap: () => onTap(lang.code),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: selected
                  ? theme.colorScheme.primaryContainer
                  : theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color:
                    selected ? theme.colorScheme.primary : Colors.transparent,
                width: 1.5,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(lang.flag, style: const TextStyle(fontSize: 16)),
                const SizedBox(width: 6),
                Text(
                  lang.label,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: selected
                        ? theme.colorScheme.onPrimaryContainer
                        : theme.colorScheme.onSurface,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _MoreButton extends StatelessWidget {
  const _MoreButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(
              color: theme.colorScheme.outline.withValues(alpha: 0.4)),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.add, size: 16, color: theme.colorScheme.primary),
            const SizedBox(width: 4),
            Text('더 보기',
                style: theme.textTheme.labelMedium
                    ?.copyWith(color: theme.colorScheme.primary)),
          ],
        ),
      ),
    );
  }
}

class _DialectRow extends ConsumerWidget {
  const _DialectRow({
    required this.languageCode,
    required this.variant,
    required this.onTap,
  });

  final String languageCode;
  final String? variant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final lang = kAllLanguages.where((l) => l.code == languageCode).firstOrNull;

    // Resolve variant code → human-readable label.
    // Falls back to the raw code while provider is loading or on error.
    final variantsAsync = ref.watch(languageVariantsProvider);
    final dialectLabel = switch (variant) {
      null => '표준어 (지역 무관)',
      final vc => variantsAsync.whenOrNull(
              data: (all) => all[languageCode]
                  ?.where((v) => v.code == vc)
                  .firstOrNull
                  ?.label,
            ) ??
            vc,
    };

    return Row(
      children: [
        Text(
          '방언/변형',
          style: theme.textTheme.bodySmall
              ?.copyWith(color: theme.colorScheme.outline),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: GestureDetector(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                border: Border.all(
                  color: theme.colorScheme.outline.withValues(alpha: 0.4),
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  if (lang != null) ...[
                    Text(lang.flag, style: const TextStyle(fontSize: 14)),
                    const SizedBox(width: 6),
                  ],
                  Expanded(
                    child: Text(
                      dialectLabel,
                      style: theme.textTheme.bodySmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Icon(
                    Icons.arrow_drop_down,
                    color: theme.colorScheme.outline,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
