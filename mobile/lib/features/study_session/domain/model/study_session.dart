import 'package:freezed_annotation/freezed_annotation.dart';

part 'study_session.freezed.dart';
part 'study_session.g.dart';

@freezed
abstract class StudySession with _$StudySession {
  const factory StudySession({
    required String id,
    String? title,
    required String createdBy,
    @Default([]) List<String> memberIds,
    required String status,
    required DateTime createdAt,
  }) = _StudySession;

  factory StudySession.fromJson(Map<String, dynamic> json) =>
      _$StudySessionFromJson(json);
}
