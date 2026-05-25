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
    // ── dialect / variant params ──────────────────────────────────────────
    /// Show dialect selector(s) — popup on selection + summary row below.
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

  /// Show dialect/variant selector popup immediately after language selection.
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

  // ── State helpers ────────────────────────────────────────────────────────

  /// Synchronously toggle a language code in/out of [_selected].
  /// Does NOT trigger dialect popup — use [_handleGridTap] for that.
  void _toggle(String code) {
    final wasSelected = _selected.contains(code);
    final next = widget.singleSelect
        ? {code}
        : (wasSelected
            ? (Set.of(_selected)..remove(code))
            : {..._selected, code});

    // Single-select: reset dialect when language changes.
    if (widget.singleSelect && !wasSelected) {
      _selectedDialect = null;
      widget.onDialectChanged?.call(null);
    }

    // Multi-select: remove the variant entry for deselected language.
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

  /// Called when the user taps a language in the primary grid.
  /// Toggles the language then — if newly selected — shows dialect popup.
  Future<void> _handleGridTap(String code) async {
    final wasSelected = _selected.contains(code);
    _toggle(code);

    // Only show dialect popup when a language is newly added, not removed.
    if (wasSelected || !widget.showDialect || !mounted) return;

    if (widget.singleSelect) {
      await _showDialectSheet();
    } else {
      await _showVariantSheet(code);
    }
  }

  // ── "기타" sheet (other languages) ───────────────────────────────────────

  Future<void> _showOther() async {
    if (widget.singleSelect) {
      await _showOtherSingle();
    } else {
      await _showOtherMulti();
    }
  }

  /// Single-select: pick one "other" language, replacing the current selection.
  Future<void> _showOtherSingle() async {
    final otherCodes = kOtherLanguages.map((l) => l.code).toSet();
    final currentOtherSelected = _selected.intersection(otherCodes);

    final result = await showOtherLanguagesSheet(
      context,
      initialSelectedCodes: currentOtherSelected,
      multiSelect: false,
    );
    if (result == null || result.isEmpty || !mounted) return;

    final pickedCode = result.first;
    setState(() {
      _selected = {pickedCode};
      _selectedDialect = null;
    });
    widget.onDialectChanged?.call(null);
    widget.onChanged([pickedCode]);

    if (!mounted || !widget.showDialect) return;
    await _showDialectSheet();
  }

  /// Multi-select: toggle multiple "other" languages; show dialect for new ones.
  Future<void> _showOtherMulti() async {
    final otherCodes = kOtherLanguages.map((l) => l.code).toSet();
    final initialOtherSelected = _selected.intersection(otherCodes);

    final result = await showOtherLanguagesSheet(
      context,
      initialSelectedCodes: initialOtherSelected,
    );
    if (result == null || !mounted) return; // null = cancelled

    final newlyAdded = result.difference(initialOtherSelected);
    final removed = initialOtherSelected.difference(result);

    final updatedVariants = Map.of(_selectedVariants)
      ..removeWhere((k, _) => removed.contains(k));

    setState(() {
      // Keep primary-grid selections; replace other-language selections.
      _selected = {..._selected.difference(otherCodes), ...result};
      _selectedVariants = updatedVariants;
    });
    widget.onChanged(_selected.toList());
    if (updatedVariants != _selectedVariants) {
      widget.onVariantsChanged?.call(Map.unmodifiable(updatedVariants));
    }

    // Show dialect popup for each newly selected "other" language.
    if (widget.showDialect) {
      for (final code in newlyAdded) {
        if (!mounted) break;
        await _showVariantSheet(code);
      }
    }
  }

  // ── Dialect / variant sheets ─────────────────────────────────────────────

  Future<void> _showDialectSheet() async {
    if (_selected.isEmpty || !mounted) return;
    final result = await showDialectBottomSheet(
      context,
      languageCode: _selected.first,
      selectedVariant: _selectedDialect,
    );
    if (!mounted) return;
    if (result == _selectedDialect) return;
    setState(() => _selectedDialect = result);
    widget.onDialectChanged?.call(result);
  }

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

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canProceed = _selected.isNotEmpty;

    final primaryCodes = kPrimaryLanguages.map((l) => l.code).toSet();
    final otherSelectedCount =
        _selected.where((c) => !primaryCodes.contains(c)).length;

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
                  // ── Primary grid: 11 languages + "기타" cell (3 × 4) ──────
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
                    itemCount: kPrimaryLanguages.length + 1,
                    itemBuilder: (context, index) {
                      // Last cell is always "기타"
                      if (index == kPrimaryLanguages.length) {
                        return _OtherGridCell(
                          selectedCount: otherSelectedCount,
                          onTap: _showOther,
                        );
                      }
                      final lang = kPrimaryLanguages[index];
                      return _LanguageGridCell(
                        lang: lang,
                        isSelected: _selected.contains(lang.code),
                        onTap: () => _handleGridTap(lang.code),
                      );
                    },
                  ),

                  // ── Single-select dialect row ──────────────────────────────
                  if (showSingleDialect) ...[
                    const SizedBox(height: 16),
                    _DialectPickerRow(
                      langCode: _selected.first,
                      selectedDialect: _selectedDialect,
                      onTap: _showDialectSheet,
                    ),
                  ],

                  // ── Multi-select variant rows ──────────────────────────────
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
// "기타" grid cell — 12th cell that opens the other-languages sheet
// ---------------------------------------------------------------------------

class _OtherGridCell extends StatelessWidget {
  const _OtherGridCell({
    required this.onTap,
    this.selectedCount = 0,
  });

  final VoidCallback onTap;

  /// Number of "other" languages currently selected (shown as a badge).
  final int selectedCount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasSelected = selectedCount > 0;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: hasSelected
              ? theme.colorScheme.secondaryContainer.withValues(alpha: 0.6)
              : theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: hasSelected
                ? theme.colorScheme.secondary
                : theme.colorScheme.outline.withValues(alpha: 0.3),
            width: hasSelected ? 1.5 : 1.0,
          ),
        ),
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.add_circle_outline_rounded,
                    size: 26,
                    color: hasSelected
                        ? theme.colorScheme.secondary
                        : theme.colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '기타',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: hasSelected
                          ? theme.colorScheme.secondary
                          : theme.colorScheme.onSurface.withValues(alpha: 0.6),
                      fontWeight: hasSelected ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ),
            if (hasSelected)
              Positioned(
                top: 6,
                right: 6,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.secondary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '$selectedCount',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSecondary,
                      fontSize: 10,
                    ),
                  ),
                ),
              ),
          ],
        ),
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
