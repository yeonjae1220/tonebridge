/// What a report points at. [apiName] matches backend
/// `ContentReportService.TargetType`; the server resolves the author itself.
enum ReportTarget {
  user('USER'),
  card('CARD'),
  nativeAudio('NATIVE_AUDIO'),
  attemptFeedback('ATTEMPT_FEEDBACK'),
  correctionRequest('CORRECTION_REQUEST'),
  correction('CORRECTION');

  const ReportTarget(this.apiName);
  final String apiName;
}

/// Matches backend `ContentReportService.Reason`.
enum ReportReason {
  spam('SPAM'),
  harassment('HARASSMENT'),
  hate('HATE'),
  sexual('SEXUAL'),
  violence('VIOLENCE'),
  illegal('ILLEGAL'),
  other('OTHER');

  const ReportReason(this.apiName);
  final String apiName;
}

/// Longest free-text detail the server accepts.
const int reportDetailMaxLength = 500;

class BlockedUser {
  const BlockedUser({
    required this.userId,
    required this.username,
    required this.blockedAt,
  });

  factory BlockedUser.fromJson(Map<String, dynamic> json) => BlockedUser(
    userId: json['userId'] as String,
    username: json['username'] as String? ?? '',
    blockedAt: DateTime.parse(json['createdAt'] as String),
  );

  final String userId;
  final String username;
  final DateTime blockedAt;
}

class BlockedUsersResult {
  const BlockedUsersResult({required this.items, required this.nextPage});

  final List<BlockedUser> items;
  final int? nextPage;
}

abstract interface class SafetyRepository {
  /// Files a report and returns its id. Reporting the same target again while
  /// the first report is open returns the same id.
  Future<String> report({
    required ReportTarget target,
    required String targetId,
    required ReportReason reason,
    String? detail,
    bool alsoBlock = false,
  });

  Future<void> block(String userId);
  Future<void> unblock(String userId);
  Future<BlockedUsersResult> blockedUsers({int page = 0});
}
