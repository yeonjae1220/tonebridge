class AdminStats {
  const AdminStats({
    required this.totalRequests,
    required this.pendingRequests,
    required this.completedRequests,
    required this.qualityPassRate,
    required this.pendingByLanguage,
  });

  factory AdminStats.fromJson(Map<String, dynamic> json) {
    final pending = (json['pendingByLanguage'] as Map<String, dynamic>? ?? {})
        .map((key, value) => MapEntry(key, (value as num).toInt()));
    return AdminStats(
      totalRequests: (json['totalRequests'] as num).toInt(),
      pendingRequests: (json['pendingRequests'] as num).toInt(),
      completedRequests: (json['completedRequests'] as num).toInt(),
      qualityPassRate: (json['qualityPassRate'] as num).toDouble(),
      pendingByLanguage: pending,
    );
  }

  final int totalRequests;
  final int pendingRequests;
  final int completedRequests;
  final double qualityPassRate;
  final Map<String, int> pendingByLanguage;
}

class AdminUserSummary {
  const AdminUserSummary({
    required this.id,
    required this.email,
    required this.username,
    required this.nativeLanguage,
    required this.credits,
    required this.reputationScore,
    required this.correctionStreak,
    required this.isAdmin,
    required this.createdAt,
  });

  factory AdminUserSummary.fromJson(Map<String, dynamic> json) {
    return AdminUserSummary(
      id: json['id'] as String,
      email: json['email'] as String,
      username: json['username'] as String,
      nativeLanguage: json['nativeLanguage'] as String,
      credits: (json['credits'] as num).toInt(),
      reputationScore: (json['reputationScore'] as num).toDouble(),
      correctionStreak: (json['correctionStreak'] as num).toInt(),
      isAdmin: json['isAdmin'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  final String id;
  final String email;
  final String username;
  final String nativeLanguage;
  final int credits;
  final double reputationScore;
  final int correctionStreak;
  final bool isAdmin;
  final DateTime createdAt;
}

class AdminUserPage {
  const AdminUserPage({
    required this.users,
    required this.page,
    required this.totalPages,
  });

  factory AdminUserPage.fromJson(Map<String, dynamic> json) {
    final content = json['content'] as List<dynamic>? ?? const [];
    return AdminUserPage(
      users: content
          .map(
            (item) => AdminUserSummary.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      page: (json['number'] as num?)?.toInt() ?? 0,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
    );
  }

  final List<AdminUserSummary> users;
  final int page;
  final int totalPages;
}
