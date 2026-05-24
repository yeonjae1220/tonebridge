import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/core/providers/core_providers.dart';

part 'language_variants_provider.g.dart';

/// A single language variant as returned by `GET /api/languages/variants`.
class LanguageVariant {
  const LanguageVariant({
    required this.code,
    required this.parentCode,
    required this.label,
    required this.variantType,
    this.labelNative,
    this.region,
  });

  factory LanguageVariant.fromJson(Map<String, dynamic> json) =>
      LanguageVariant(
        code: json['code'] as String,
        parentCode: json['parentCode'] as String,
        label: json['label'] as String,
        variantType: json['variantType'] as String? ?? 'DIALECT',
        labelNative: json['labelNative'] as String?,
        region: json['region'] as String?,
      );

  final String code;
  final String parentCode;
  final String label;
  final String variantType;
  final String? labelNative;
  final String? region;
}

/// All language variants grouped by parent language code.
///
/// `keepAlive: true` — fetched once per app session.  The variants list is
/// static reference data that does not change at runtime, so there is no need
/// to re-fetch when a new listener subscribes.
@Riverpod(keepAlive: true)
Future<Map<String, List<LanguageVariant>>> languageVariants(Ref ref) async {
  final dio = ref.watch(dioProvider);
  final res =
      await dio.get<Map<String, dynamic>>('/api/languages/variants');
  final raw = res.data ?? {};
  return {
    for (final entry in raw.entries)
      entry.key: (entry.value as List<dynamic>)
          .cast<Map<String, dynamic>>()
          .map(LanguageVariant.fromJson)
          .toList(),
  };
}
