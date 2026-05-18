import 'package:tonebridge/features/profile/domain/model/user_profile.dart';

abstract interface class ProfileRepository {
  Future<UserProfile> getProfile();
}
