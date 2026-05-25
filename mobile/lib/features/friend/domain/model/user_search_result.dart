import 'package:freezed_annotation/freezed_annotation.dart';

part 'user_search_result.freezed.dart';
part 'user_search_result.g.dart';

@freezed
abstract class UserSearchResult with _$UserSearchResult {
  const factory UserSearchResult({
    required String id,
    required String username,
    required String nativeLanguage,
  }) = _UserSearchResult;

  factory UserSearchResult.fromJson(Map<String, dynamic> json) =>
      _$UserSearchResultFromJson(json);
}
