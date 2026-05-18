import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_response.freezed.dart';
part 'auth_response.g.dart';

@freezed
class TokenResponse with _$TokenResponse {
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
class UserResponse with _$UserResponse {
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
  }) = _UserResponse;

  factory UserResponse.fromJson(Map<String, dynamic> json) =>
      _$UserResponseFromJson(json);
}

@freezed
class UserData with _$UserData {
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
  }) = _UserData;

  factory UserData.fromJson(Map<String, dynamic> json) =>
      _$UserDataFromJson(json);
}
