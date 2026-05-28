import 'package:freezed_annotation/freezed_annotation.dart';

part 'user.freezed.dart';
part 'user.g.dart';

@freezed
abstract class User with _$User {
  const factory User({
    required String id,
    required String email,
    required String username,
    required String nativeLanguage,
    @Default('ko') String uiLanguage,
    required List<String> fluentLanguages,
    required List<String> learningLanguages,
    required int credits,
    @Default(5.0) double reputationScore,
    String? nativeDialect,
    @Default(<String, String>{}) Map<String, String> fluentLanguageVariants,
    @Default(<String, String>{}) Map<String, String> learningLanguageVariants,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}

/// Lightweight session state passed through the app.
@freezed
abstract class AuthSession with _$AuthSession {
  const factory AuthSession({
    required User user,
    required String accessToken,
    @Default(false) bool needsOnboarding,
  }) = _AuthSession;

  const AuthSession._();

  bool get isLoggedIn => accessToken.isNotEmpty;
}
