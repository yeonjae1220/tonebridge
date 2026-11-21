import 'package:freezed_annotation/freezed_annotation.dart';

part 'sound_target.freezed.dart';
part 'sound_target.g.dart';

/// A pronunciation guide a piece of feedback points at (server field `soundTargets`).
@freezed
abstract class SoundTarget with _$SoundTarget {
  const factory SoundTarget({required String guideId}) = _SoundTarget;

  factory SoundTarget.fromJson(Map<String, dynamic> json) =>
      _$SoundTargetFromJson(json);
}
