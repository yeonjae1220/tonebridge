import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:tonebridge/features/profile/data/profile_repository_impl.dart';
import 'package:tonebridge/features/profile/domain/model/user_profile.dart';

part 'profile_provider.g.dart';

@riverpod
Future<UserProfile> userProfile(Ref ref) =>
    ref.watch(profileRepositoryProvider).getProfile();
