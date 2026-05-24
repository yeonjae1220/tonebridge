import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/constants/languages.dart';
import 'package:tonebridge/core/providers/language_variants_provider.dart';
import 'package:tonebridge/core/widgets/language_picker/dialect_bottom_sheet.dart';
import 'package:tonebridge/core/widgets/language_picker/other_languages_sheet.dart';

class LanguageSelectPage extends ConsumerStatefulWidget {
  const LanguageSelectPage({
    required this.title,
    required this.subtitle,
    required this.singleSelect,
    required this.onChanged,
    required this.onNext,
    super.key,
    this.initialValues = const [],
    this.nextLabel = '다음',
    this.isLoading = false,
    /// Codes to hide from the primary language grid.
    /// Excluded primary-language entries are still discoverable via the
    /// "기타 언어" sheet so the user can pick them if needed.
    this.excludeCodes = const [],
    // ── dialect / variant params ──────────────────────────────────────────
    /// Show dialect selector(s) below the grid.
    this.showDialect = false,
    // Single-select mode only
    this.initialDialect,
    this.onDialectChanged,
    // Multi-select mode only
    this.initialVariants = const {},
    this.onVariantsChanged,
  });

  final String title;
  final String subtitle;
  final bool singleSelect;
  final ValueChanged<List<String>> onChanged;
  final VoidCallback onNext;
  final List<String> initialValues;
  final String nextLabel;
  final bool isLoading;

  /// Codes hidden from the primary grid but surfaced in the "기타 언어" sheet.
  final List<String> excludeCodes;

  /// Show dialect/variant selector(s) below the grid.
  final bool showDialect;

  // ── single-select dialect ────────────────────────────────────────────────
  /// Pre-selected variant code. null means 표준어 (standard).
  final String? initialDialect;

  /// Called when the user picks a dialect. null = 표준어.
  final ValueChanged<String?>? onDialectChanged;

  // ── multi-select dialect ─────────────────────────────────────────────────
  /// Pre-selected variant codes keyed by language code.
  final Map<String, String> initialVariants;

  /// Called whenever the per-language variant map changes.
  final ValueChanged<Map<String, String>>? onVariantsChanged;

  @override
  ConsumerState<LanguageSelectPage> createState() => _LanguageSelectPageState();
}

class _LanguageSelectPageState extends ConsumerState<LanguageSelectPage> {
  Set<String> _selected = {};

  /// Primary languages visible in the main grid (excludeCodes are hidden here
  /// but still accessible via the "기타 언어" sheet).
  List<LanguageEntry> get _primaryGrid => kPrimaryLanguages
      .where((l) => !widget.excludeCodes.contains(l.code))
      .toList();

  // Single-select dialect state
  String? _selectedDialect;

  // Multi-select variant state: languageCode → variantCode
  late Map<String, String> _selectedVariants;

  @override
  void initState() {
    super.initState();
    _selected = Set.of(widget.initialValues);
    _selectedDialect = widget.initialDialect;
    _selectedVariants = Map.of(widget.initialVariants);
  }

  void _toggle(String code) {
    final wasSelected = _selected.contains(code);
    final next = widget.singleSelect
        ? {code}
        : (wasSelected
            ? (_selected.toSet()..remove(code))
            : {..._selected, code});

    // Single-select: reset dialect when language changes.
    if (widget.singleSelect && !wasSelected) {
      _selectedDialect = null;
      widget.onDialectChanged?.call(null);
    }

    // Multi-select: remove the variant entry for deselected languages.
    // Computed before setState so both mutations happen in one frame.
    Map<String, String>? updatedVariants;
    if (!widget.singleSelect && wasSelected && _selectedVariants.containsKey(code)) {
      updatedVariants = Map.of(_selectedVariants)..remove(code);
    }

    setState(() {
      _selected = next;
      if (updatedVariants != null) _selectedVariants = updatedVariants;
    });

    if (updatedVariants != null) widget.onVariantsChanged?.call(updatedVariants);
    widget.onChanged(next.toList());
  }

  Future<void> _showOther() async {
    // Primary-language entries excluded from the grid (e.g. the native
    // language on fluent/learning steps) are surfaced at the top of the sheet
    // so the user can still find and pick them when needed.
    final excludedPrimary = widget.excludeCodes
        .map(
          (code) =>
              kPrimaryLanguages.where((l) => l.code == code).firstOrNull,
        )
        .whereType<LanguageEntry>()
        .toList();

    final picked = await showOtherLanguagesSheet(
      context,
      selectedCodes: _selected.toList(),
      additionalEntries: excludedPrimary,
    );
    if (picked == null || !mounted) return;
    _toggle(picked.code);
  }

  // ── single-select dialect sheet ──────────────────────────────────────────

  Future<void> _showDialectSheet() async {
    if (_selected.isEmpty || !mounted) return;
    final result = await showDialectBottomSheet(
      context,
      languageCode: _selected.first,
      selectedVariant: _selectedDialect,
    );
    if (!mounted) return;
    // The close (×) button pops with the existing selection, so result ==
    // _selectedDialect means the user dismissed without changing anything.
    if (result == _selectedDialect) return;
    setState(() => _selectedDialect = result);
    widget.onDialectChanged?.call(result);
  }

  // ── multi-select variant sheet ───────────────────────────────────────────

  Future<void> _showVariantSheet(String langCode) async {
    if (!mounted) return;
    final result = await showDialectBottomSheet(
      context,
      languageCode: langCode,
      selectedVariant: _selectedVariants[langCode],
    );
    if (!mounted) return;
    if (result == _selectedVariants[langCode]) return;
    final updated = Map.of(_selectedVariants);
    if (result == null) {
      updated.remove(langCode);
    } else {
      updated[langCode] = result;
    }
    setState(() => _selectedVariants = updated);
    widget.onVariantsChanged?.call(Map.unmodifiable(updated));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canProceed = _selected.isNotEmpty;

    // Codes selected that are NOT shown in the current primary grid.
    // This includes kOtherLanguages selections AND excluded primary languages
    // (e.g. the native language selected via the "기타 언어" sheet).
    final primaryGridCodes = _primaryGrid.map((l) => l.code).toSet();
    final otherSelected =
        _selected.where((code) => !primaryGridCodes.contains(code)).toList();

    final showSingleDialect =
        widget.showDialect && widget.singleSelect && _selected.isNotEmpty;
    final showMultiDialect =
        widget.showDialect && !widget.singleSelect && _selected.isNotEmpty;

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
                    itemCount: _primaryGrid.length,
                    itemBuilder: (context, index) {
                      final lang = _primaryGrid[index];
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
                        // Search kAllLanguages so chips work for both
                        // kOtherLanguages entries and excluded primary languages.
                        final lang = kAllLanguages
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
                  // ── Single-select dialect row ─────────────────────────
                  if (showSingleDialect) ...[
                    const SizedBox(height: 16),
                    _DialectPickerRow(
                      langCode: _selected.first,
                      selectedDialect: _selectedDialect,
                      onTap: _showDialectSheet,
                    ),
                  ],
                  // ── Multi-select variant rows ─────────────────────────
                  if (showMultiDialect) ...[
                    const SizedBox(height: 20),
                    _MultiVariantSection(
                      selectedCodes: _selected.toList(),
                      selectedVariants: Map.of(_selectedVariants),
                      onTap: _showVariantSheet,
                    ),
                  ],
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
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      semanticsLabel: '로딩 중',
                    ),
                  )
                : Text(widget.nextLabel),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Multi-select variant section
// ---------------------------------------------------------------------------

class _MultiVariantSection extends ConsumerWidget {
  const _MultiVariantSection({
    required this.selectedCodes,
    required this.selectedVariants,
    required this.onTap,
  });

  final List<String> selectedCodes;
  final Map<String, String> selectedVariants;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final variantsAsync = ref.watch(languageVariantsProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '방언/변형 (선택 사항)',
          style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.outline,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 8),
        ...selectedCodes.map((code) {
          final lang =
              kAllLanguages.where((l) => l.code == code).firstOrNull;
          final selectedVariantCode = selectedVariants[code];

          // Resolve human-readable label for the selected variant.
          final dialectLabel = switch (selectedVariantCode) {
            null => '표준어 (지역 무관)',
            final vc => variantsAsync.whenOrNull(
                  data: (all) => all[code]
                      ?.where((v) => v.code == vc)
                      .firstOrNull
                      ?.label,
                ) ??
                vc,
          };

          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _MultiVariantRow(
              langLabel: lang?.label ?? code,
              langFlag: lang?.flag ?? '🌐',
              dialectLabel: dialectLabel,
              hasVariant: selectedVariantCode != null,
              onTap: () => onTap(code),
            ),
          );
        }),
      ],
    );
  }
}

class _MultiVariantRow extends StatelessWidget {
  const _MultiVariantRow({
    required this.langLabel,
    required this.langFlag,
    required this.dialectLabel,
    required this.hasVariant,
    required this.onTap,
  });

  final String langLabel;
  final String langFlag;
  final String dialectLabel;
  final bool hasVariant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          border: Border.all(
            color: hasVariant
                ? theme.colorScheme.primary.withValues(alpha: 0.6)
                : theme.colorScheme.outline.withValues(alpha: 0.35),
          ),
          color: hasVariant
              ? theme.colorScheme.primaryContainer.withValues(alpha: 0.2)
              : null,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Text(langFlag, style: const TextStyle(fontSize: 18)),
            const SizedBox(width: 8),
            Text(
              langLabel,
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: hasVariant ? theme.colorScheme.primary : null,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                dialectLabel,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: hasVariant
                      ? theme.colorScheme.primary
                      : theme.colorScheme.outline,
                ),
                textAlign: TextAlign.end,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.arrow_drop_down,
              color: theme.colorScheme.outline,
              size: 18,
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Single-select dialect picker row
// ---------------------------------------------------------------------------

class _DialectPickerRow extends ConsumerWidget {
  const _DialectPickerRow({
    required this.langCode,
    required this.selectedDialect,
    required this.onTap,
  });

  final String langCode;
  final String? selectedDialect;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final lang = kAllLanguages.where((l) => l.code == langCode).firstOrNull;

    // Resolve the human-readable label for the selected dialect code.
    // Falls back to the raw code while the provider is loading or on error.
    final dialectLabel = switch (selectedDialect) {
      null => '표준어 (지역 무관)',
      final code => ref.watch(languageVariantsProvider).whenOrNull(
            data: (allVariants) => allVariants[langCode]
                ?.where((v) => v.code == code)
                .firstOrNull
                ?.label,
          ) ??
          code,
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
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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

// ---------------------------------------------------------------------------
// Language grid cell
// ---------------------------------------------------------------------------

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
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
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
