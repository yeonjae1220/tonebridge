import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:tonebridge/core/constants/languages.dart';

class _VariantItem {
  const _VariantItem({
    required this.code,
    required this.label,
    this.labelNative,
    this.region,
    required this.variantType,
  });

  final String code;
  final String label;
  final String? labelNative;
  final String? region;
  final String variantType;
}

const _variantTypeLabels = {
  'DIALECT': '방언',
  'ACCENT': '악센트',
  'SCRIPT': '문자 체계',
};

class DialectBottomSheet extends StatefulWidget {
  const DialectBottomSheet({
    super.key,
    required this.languageCode,
    required this.selectedVariant,
    required this.dio,
  });

  final String languageCode;
  final String? selectedVariant;
  final Dio dio;

  @override
  State<DialectBottomSheet> createState() => _DialectBottomSheetState();
}

class _DialectBottomSheetState extends State<DialectBottomSheet> {
  List<_VariantItem> _variants = [];
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await widget.dio
          .get<Map<String, dynamic>>('/api/languages/variants');
      final raw = res.data ?? {};
      final items = (raw[widget.languageCode] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>()
          .map((v) => _VariantItem(
                code: v['code'] as String,
                label: v['label'] as String,
                labelNative: v['labelNative'] as String?,
                region: v['region'] as String?,
                variantType: v['variantType'] as String? ?? 'DIALECT',
              ))
          .toList();
      if (mounted) setState(() { _variants = items; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _loading = false; _error = true; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final langName = langLabel(widget.languageCode);

    final grouped = <String, List<_VariantItem>>{};
    for (final v in _variants) {
      grouped.putIfAbsent(v.variantType, () => []).add(v);
    }

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      maxChildSize: 0.85,
      builder: (context, scrollController) => Column(
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
                Text('$langName — 방언/변형 선택',
                    style: theme.textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error
                    ? Center(
                        child: Text('방언 정보를 불러오지 못했습니다',
                            style: theme.textTheme.bodyMedium?.copyWith(
                                color: theme.colorScheme.error)),
                      )
                    : ListView(
                        controller: scrollController,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 8),
                        children: [
                          // Standard option
                          _VariantTile(
                            label: '표준어 (지역 무관)',
                            selected: widget.selectedVariant == null,
                            onTap: () => Navigator.of(context).pop(null),
                          ),
                          const SizedBox(height: 12),
                          if (_variants.isEmpty)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              child: Text(
                                '등록된 방언/변형 정보가 없습니다',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                    color: theme.colorScheme.outline),
                                textAlign: TextAlign.center,
                              ),
                            )
                          else
                            ...grouped.entries.map((entry) => Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _variantTypeLabels[entry.key] ??
                                          entry.key,
                                      style: theme.textTheme.labelSmall
                                          ?.copyWith(
                                        color: theme.colorScheme.outline,
                                        letterSpacing: 0.8,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    ...entry.value.map((v) => Padding(
                                          padding: const EdgeInsets.only(
                                              bottom: 6),
                                          child: _VariantTile(
                                            label: v.label,
                                            subtitle: v.labelNative ??
                                                v.region,
                                            selected: widget.selectedVariant ==
                                                v.code,
                                            onTap: () => Navigator.of(context)
                                                .pop(v.code),
                                          ),
                                        )),
                                    const SizedBox(height: 8),
                                  ],
                                )),
                        ],
                      ),
          ),
        ],
      ),
    );
  }
}

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
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w500,
                        color: selected
                            ? theme.colorScheme.primary
                            : null,
                      )),
                  if (subtitle != null)
                    Text(subtitle!,
                        style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.outline)),
                ],
              ),
            ),
            if (selected)
              Icon(Icons.check_circle_rounded,
                  color: theme.colorScheme.primary, size: 20),
          ],
        ),
      ),
    );
  }
}

/// Returns the selected variant code, or null if "표준어" was selected,
/// or the existing variant if dismissed.
Future<String?> showDialectBottomSheet(
  BuildContext context, {
  required String languageCode,
  required String? selectedVariant,
  required Dio dio,
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
      dio: dio,
    ),
  );
}
