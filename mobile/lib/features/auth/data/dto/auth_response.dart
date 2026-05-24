import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_response.freezed.dart';
part 'auth_response.g.dart';

@freezed
abstract class TokenResponse with _$TokenResponse {
  const factory TokenResponse({
    required String accessToken,
    required String refreshToken,
    required bool needsOnboarding,
    required UserData user,
  }) = _TokenResponse;

  factory TokenResponse.fromJson(Map<String, dynamic> json) =>
      _$TokenResponseFromJson(json);
}

@freezed
abstract class UserResponse with _$UserResponse {
  const factory UserResponse({
    required String id,
    required String email,
    required String username,
    required String nativeLanguage,
    required List<String> fluentLanguages,
    required List<String> learningLanguages,
    required int credits,
    @Default(5.0) double reputationScore,
    @Default(false) bool onboardingCompleted,
    String? nativeDialect,
    @Default(<String, String>{}) Map<String, String> fluentLanguageVariants,
    @Default(<String, String>{}) Map<String, String> learningLanguageVariants,
  }) = _UserResponse;

  factory UserResponse.fromJson(Map<String, dynamic> json) =>
      _$UserResponseFromJson(json);
}

@freezed
abstract class UserData with _$UserData {
  const factory UserData({
    required String id,
    required String email,
    required String username,
    required String nativeLanguage,
    required List<String> fluentLanguages,
    required List<String> learningLanguages,
    required int credits,
    @Default(5.0) double reputationScore,
    @Default(false) bool onboardingCompleted,
    String? nativeDialect,
    @Default(<String, String>{}) Map<String, String> fluentLanguageVariants,
    @Default(<String, String>{}) Map<String, String> learningLanguageVariants,
  }) = _UserData;

  factory UserData.fromJson(Map<String, dynamic> json) =>
      _$UserDataFromJson(json);
}
