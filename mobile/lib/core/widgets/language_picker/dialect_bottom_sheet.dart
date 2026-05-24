import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/constants/languages.dart';
import 'package:tonebridge/core/providers/language_variants_provider.dart';

const _variantTypeLabels = {
  'DIALECT': '방언',
  'ACCENT': '악센트',
  'SCRIPT': '문자 체계',
};

class DialectBottomSheet extends ConsumerWidget {
  const DialectBottomSheet({
    required this.languageCode,
    required this.selectedVariant,
    super.key,
  });

  final String languageCode;
  final String? selectedVariant;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final variantsAsync = ref.watch(languageVariantsProvider);
    final theme = Theme.of(context);
    final langName = langLabel(languageCode);

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      maxChildSize: 0.85,
      builder: (sheetContext, scrollController) => Column(
        children: [
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 8),
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: theme.colorScheme.outline.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Text(
                  '$langName — 방언/변형 선택',
                  style: theme.textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  // Pop with the current selection so dismiss ≠ "clear dialect".
                  // The caller treats a return value equal to its input as "no change".
                  onPressed: () =>
                      Navigator.of(sheetContext).pop(selectedVariant),
                ),
              ],
            ),
          ),
          Expanded(
            child: variantsAsync.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (_, __) => Center(
                child: Text(
                  '방언 정보를 불러오지 못했습니다',
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: theme.colorScheme.error),
                ),
              ),
              data: (allVariants) {
                final variants = allVariants[languageCode] ?? [];
                final grouped = <String, List<LanguageVariant>>{};
                for (final v in variants) {
                  grouped.putIfAbsent(v.variantType, () => []).add(v);
                }
                return ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 8,
                  ),
                  children: [
                    // Standard / no-variant option
                    _VariantTile(
                      label: '표준어 (지역 무관)',
                      selected: selectedVariant == null,
                      onTap: () => Navigator.of(sheetContext).pop(),
                    ),
                    const SizedBox(height: 12),
                    if (variants.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text(
                          '등록된 방언/변형 정보가 없습니다',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.outline,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      )
                    else
                      ...grouped.entries.map(
                        (entry) => Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _variantTypeLabels[entry.key] ?? entry.key,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: theme.colorScheme.outline,
                                letterSpacing: 0.8,
                              ),
                            ),
                            const SizedBox(height: 6),
                            ...entry.value.map(
                              (v) => Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: _VariantTile(
                                  label: v.label,
                                  subtitle: v.labelNative ?? v.region,
                                  selected: selectedVariant == v.code,
                                  onTap: () =>
                                      Navigator.of(sheetContext).pop(v.code),
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                          ],
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Variant tile
// ---------------------------------------------------------------------------

class _VariantTile extends StatelessWidget {
  const _VariantTile({
    required this.label,
    required this.selected,
    required this.onTap,
    this.subtitle,
  });

  final String label;
  final String? subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(
            color: selected
                ? theme.colorScheme.primary
                : theme.colorScheme.outline.withValues(alpha: 0.3),
            width: selected ? 2 : 1,
          ),
          color: selected
              ? theme.colorScheme.primaryContainer.withValues(alpha: 0.4)
              : null,
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w500,
                      color: selected ? theme.colorScheme.primary : null,
                    ),
                  ),
                  if (subtitle != null)
                    Text(
                      subtitle!,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.outline),
                    ),
                ],
              ),
            ),
            if (selected)
              Icon(
                Icons.check_circle_rounded,
                color: theme.colorScheme.primary,
                size: 20,
              ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Returns the selected variant code, or null if "표준어" was selected,
/// or the existing variant if dismissed.
Future<String?> showDialectBottomSheet(
  BuildContext context, {
  required String languageCode,
  required String? selectedVariant,
}) {
  return showModalBottomSheet<String?>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => DialectBottomSheet(
      languageCode: languageCode,
      selectedVariant: selectedVariant,
    ),
  );
}
