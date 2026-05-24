import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:tonebridge/core/constants/languages.dart';

class OtherLanguagesSheet extends StatefulWidget {
  const OtherLanguagesSheet({
    required this.onSelect,
    super.key,
    this.selectedCodes = const [],
    this.additionalEntries = const [],
  });

  /// Called when a tile is tapped.
  /// The caller decides whether this is a select or deselect based on
  /// whether the code was already in [selectedCodes].
  final ValueChanged<LanguageEntry> onSelect;

  /// Already-selected codes — shown highlighted with a checkmark
  /// so the user can also tap again to deselect.
  final List<String> selectedCodes;

  /// Extra entries prepended before the kOtherLanguages list.
  /// Used to surface primary-language codes that were excluded from
  /// the main grid (e.g. the native language on fluent/learning steps).
  final List<LanguageEntry> additionalEntries;

  @override
  State<OtherLanguagesSheet> createState() => _OtherLanguagesSheetState();
}

class _OtherLanguagesSheetState extends State<OtherLanguagesSheet> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    // Merge additionalEntries + kOtherLanguages, avoiding duplicates.
    final additionalCodes = widget.additionalEntries.map((e) => e.code).toSet();
    final combined = [
      ...widget.additionalEntries,
      ...kOtherLanguages.where((l) => !additionalCodes.contains(l.code)),
    ];

    final filtered = combined
        .where(
          (l) =>
              _query.isEmpty ||
              l.label.contains(_query) ||
              l.code.contains(_query.toLowerCase()),
        )
        .toList();

    return Column(
      children: [
        // Drag handle
        Container(
          margin: const EdgeInsets.only(top: 12, bottom: 8),
          width: 36,
          height: 4,
          decoration: BoxDecoration(
            color: theme.colorScheme.outline.withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        // Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Text(
                '기타 언어 선택',
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
        // Search field
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: TextField(
            controller: _controller,
            autofocus: true,
            decoration: InputDecoration(
              hintText: '언어 검색...',
              prefixIcon: const Icon(Icons.search, size: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(
                  color: theme.colorScheme.outline.withValues(alpha: 0.4),
                ),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              isDense: true,
            ),
            onChanged: (v) => setState(() => _query = v.trim()),
          ),
        ),
        // Grid
        Expanded(
          child: filtered.isEmpty
              ? Center(
                  child: Text(
                    '검색 결과가 없습니다',
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: theme.colorScheme.outline),
                  ),
                )
              : ScrollConfiguration(
                  behavior: ScrollConfiguration.of(context).copyWith(
                    dragDevices: {
                      PointerDeviceKind.touch,
                      PointerDeviceKind.mouse,
                    },
                  ),
                  child: GridView.builder(
                    // Internal bottom padding absorbs the safe-area inset so
                    // the last row is never clipped by home-indicator / nav bar.
                    padding: EdgeInsets.fromLTRB(
                      20,
                      8,
                      20,
                      MediaQuery.of(context).viewPadding.bottom + 32,
                    ),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      mainAxisExtent: 52,
                    ),
                    itemCount: filtered.length,
                    itemBuilder: (context, i) {
                      final lang = filtered[i];
                      final isSelected =
                          widget.selectedCodes.contains(lang.code);
                      return _LanguageTile(
                        lang: lang,
                        isSelected: isSelected,
                        onTap: () => widget.onSelect(lang),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Individual language tile
// ---------------------------------------------------------------------------

class _LanguageTile extends StatelessWidget {
  const _LanguageTile({
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
      borderRadius: BorderRadius.circular(12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        decoration: BoxDecoration(
          color: isSelected
              ? theme.colorScheme.primaryContainer.withValues(alpha: 0.45)
              : null,
          border: Border.all(
            color: isSelected
                ? theme.colorScheme.primary
                : theme.colorScheme.outline.withValues(alpha: 0.3),
            width: isSelected ? 1.5 : 1.0,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Text(lang.flag, style: const TextStyle(fontSize: 20)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                lang.label,
                style: theme.textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: isSelected
                      ? theme.colorScheme.onPrimaryContainer
                      : null,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (isSelected)
              Icon(
                Icons.check_circle,
                size: 15,
                color: theme.colorScheme.primary,
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

Future<LanguageEntry?> showOtherLanguagesSheet(
  BuildContext context, {
  List<String> selectedCodes = const [],
  List<LanguageEntry> additionalEntries = const [],
}) {
  return showModalBottomSheet<LanguageEntry>(
    context: context,
    isScrollControlled: true,
    constraints: BoxConstraints(
      maxHeight: MediaQuery.of(context).size.height * 0.82,
    ),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetCtx) => OtherLanguagesSheet(
      selectedCodes: selectedCodes,
      additionalEntries: additionalEntries,
      onSelect: (lang) => Navigator.of(sheetCtx).pop(lang),
    ),
  );
}
