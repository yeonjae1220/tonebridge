import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:tonebridge/core/constants/languages.dart';

class OtherLanguagesSheet extends StatefulWidget {
  const OtherLanguagesSheet({
    required this.onSelect,
    super.key,
    this.excludeCodes = const [],
  });

  final ValueChanged<LanguageEntry> onSelect;
  final List<String> excludeCodes;

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
    final filtered = kOtherLanguages
        .where(
          (l) =>
              !widget.excludeCodes.contains(l.code) &&
              (_query.isEmpty || l.label.contains(_query)),
        )
        .toList();

    return Column(
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 8,
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
                    return InkWell(
                      onTap: () => widget.onSelect(lang),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: theme.colorScheme.outline
                                .withValues(alpha: 0.3),
                          ),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        child: Row(
                          children: [
                            Text(
                              lang.flag,
                              style: const TextStyle(fontSize: 20),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                lang.label,
                                style: theme.textTheme.bodySmall
                                    ?.copyWith(fontWeight: FontWeight.w500),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                ),
        ),
        SizedBox(height: MediaQuery.of(context).viewPadding.bottom + 8),
      ],
    );
  }
}

Future<LanguageEntry?> showOtherLanguagesSheet(
  BuildContext context, {
  List<String> excludeCodes = const [],
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
    builder: (_) => OtherLanguagesSheet(
      excludeCodes: excludeCodes,
      onSelect: (lang) => Navigator.of(context).pop(lang),
    ),
  );
}
