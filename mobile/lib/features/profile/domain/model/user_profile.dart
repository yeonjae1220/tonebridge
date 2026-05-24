import 'package:freezed_annotation/freezed_annotation.dart';

part 'user_profile.freezed.dart';
part 'user_profile.g.dart';

@freezed
abstract class UserProfile with _$UserProfile {
  const factory UserProfile({
    required String id,
    required String username,
    required String nativeLanguage,
    required List<String> fluentLanguages,
    @Default([]) List<String> learningLanguages,
    required int correctionStreak,
    required double reputationScore,
    required String correctorLevel,
    @Default([]) List<UserBadge> badges,
    String? nativeDialect,
    @Default(<String, String>{}) Map<String, String> fluentLanguageVariants,
    @Default(<String, String>{}) Map<String, String> learningLanguageVariants,
  }) = _UserProfile;

  factory UserProfile.fromJson(Map<String, dynamic> json) =>
      _$UserProfileFromJson(json);
}

@freezed
abstract class UserBadge with _$UserBadge {
  const factory UserBadge({
    required String badgeType,
    required DateTime awardedAt,
  }) = _UserBadge;

  factory UserBadge.fromJson(Map<String, dynamic> json) =>
      _$UserBadgeFromJson(json);
}
