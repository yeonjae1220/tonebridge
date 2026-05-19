import 'package:tonebridge/features/profile/domain/model/user_profile.dart';

abstract interface class ProfileRepository {
  Future<UserProfile> getProfile();
  Future<void> updateLanguages({
    required String nativeLanguage,
    required List<String> fluentLanguages,
    required List<String> learningLanguages,
  });
}
