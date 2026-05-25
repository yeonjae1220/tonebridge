import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:tonebridge/core/constants/languages.dart';

/// Bottom sheet for selecting languages outside the primary 11-language grid.
///
/// [multiSelect] = true  → tap toggles highlight, "확인" button applies
/// [multiSelect] = false → tap immediately closes with the picked language
///
/// Returns [Set<String>?]:
///   - null  → user cancelled (X button in multi-select)
///   - Set   → final set of selected other-language codes
class OtherLanguagesSheet extends StatefulWidget {
  const OtherLanguagesSheet({
    required this.initialSelectedCodes,
    required this.multiSelect,
    super.key,
  });

  /// Codes that are already selected when the sheet opens.
  final Set<String> initialSelectedCodes;

  /// true  → multi-select mode (stay open, confirm via button)
  /// false → single-select mode (close immediately on tap)
  final bool multiSelect;

  @override
  State<OtherLanguagesSheet> createState() => _OtherLanguagesSheetState();
}

class _OtherLanguagesSheetState extends State<OtherLanguagesSheet> {
  final _controller = TextEditingController();
  String _query = '';
  late Set<String> _localSelected;

  @override
  void initState() {
    super.initState();
    _localSelected = Set.of(widget.initialSelectedCodes);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTap(LanguageEntry lang) {
    if (!widget.multiSelect) {
      // Single-select: pick immediately and close.
      Navigator.of(context).pop({lang.code});
      return;
    }
    setState(() {
      if (_localSelected.contains(lang.code)) {
        _localSelected = Set.of(_localSelected)..remove(lang.code);
      } else {
        _localSelected = {..._localSelected, lang.code};
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final filtered = kOtherLanguages
        .where(
          (l) =>
              _query.isEmpty ||
              l.label.contains(_query) ||
              l.code.contains(_query.toLowerCase()),
        )
        .toList();

    // Number of newly added languages (to show in confirm button label).
    final addedCount =
        _localSelected.difference(widget.initialSelectedCodes).length;

    return Column(
      children: [
        // ── Drag handle ─────────────────────────────────────────────────────
        Container(
          margin: const EdgeInsets.only(top: 12, bottom: 8),
          width: 36,
          height: 4,
          decoration: BoxDecoration(
            color: theme.colorScheme.outline.withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(2),
          ),
        ),

        // ── Header ──────────────────────────────────────────────────────────
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
              // X button always cancels (returns null in multi-select)
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(
                  widget.multiSelect ? null : null,
                ),
              ),
            ],
          ),
        ),

        // ── Search field ─────────────────────────────────────────────────────
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

        // ── Language grid ────────────────────────────────────────────────────
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
                    padding: EdgeInsets.fromLTRB(
                      20,
                      8,
                      20,
                      widget.multiSelect
                          ? 8
                          : MediaQuery.of(context).viewPadding.bottom + 32,
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
                      final isSelected = _localSelected.contains(lang.code);
                      return _LanguageTile(
                        lang: lang,
                        isSelected: isSelected,
                        onTap: () => _handleTap(lang),
                      );
                    },
                  ),
                ),
        ),

        // ── Confirm button (multi-select only) ───────────────────────────────
        if (widget.multiSelect)
          Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              8,
              20,
              MediaQuery.of(context).viewPadding.bottom + 16,
            ),
            child: FilledButton(
              onPressed: () =>
                  Navigator.of(context).pop(Set.of(_localSelected)),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
              child: Text(
                addedCount > 0 ? '확인 (+$addedCount)' : '확인',
              ),
            ),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Language tile
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

/// Shows the other-languages bottom sheet.
///
/// [initialSelectedCodes] — codes already selected (shown highlighted).
/// [multiSelect]          — true: stay-open toggle mode; false: pick-and-close.
///
/// Returns null when the user cancels (X button in multi-select mode).
/// Returns a [Set<String>] of selected codes otherwise.
Future<Set<String>?> showOtherLanguagesSheet(
  BuildContext context, {
  Set<String> initialSelectedCodes = const {},
  bool multiSelect = true,
}) {
  return showModalBottomSheet<Set<String>>(
    context: context,
    isScrollControlled: true,
    constraints: BoxConstraints(
      maxHeight: MediaQuery.of(context).size.height * 0.82,
    ),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => OtherLanguagesSheet(
      initialSelectedCodes: initialSelectedCodes,
      multiSelect: multiSelect,
    ),
  );
}
