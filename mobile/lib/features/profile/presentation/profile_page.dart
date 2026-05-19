import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/constants/languages.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/profile/domain/model/user_profile.dart';
import 'package:tonebridge/features/profile/presentation/profile_provider.dart';

const _badgeMeta = {
  'STREAK_7DAY': (icon: '🔥', label: '7일 스트릭', desc: '7일 연속 교정 달성'),
  'FAST_RESPONDER': (icon: '⚡', label: '빠른 응답', desc: '60분 이내 교정 5회 달성'),
  'AUDIO_EXPERT': (icon: '🎙', label: '음성 전문가', desc: '음성 교정 10회 달성'),
  'STREAK_7': (icon: '🔥', label: '7일 스트릭', desc: '7일 연속 교정 달성'),
  'STREAK_30': (icon: '🏅', label: '30일 스트릭', desc: '30일 연속 교정 달성'),
};

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('프로필'),
        actions: [
          if (profileAsync.hasValue)
            IconButton(
              icon: const Icon(Icons.language_rounded),
              tooltip: '언어 설정',
              onPressed: () => context.push(
                AppRoute.languageEdit,
                extra: profileAsync.value,
              ),
            ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            onPressed: () =>
                ref.read(authStateProvider.notifier).signOut(),
          ),
        ],
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline_rounded,
                  size: 48, color: theme.colorScheme.error),
              const SizedBox(height: 12),
              Text('프로필을 불러올 수 없습니다',
                  style: theme.textTheme.titleMedium),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => ref.invalidate(userProfileProvider),
                child: const Text('다시 시도'),
              ),
            ],
          ),
        ),
        data: (profile) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(userProfileProvider),
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _ProfileHeader(profile: profile),
              const SizedBox(height: 20),
              _StatsRow(profile: profile),
              const SizedBox(height: 20),
              // Reputation bar
              _ReputationSection(score: profile.reputationScore),
              const SizedBox(height: 20),
              // Streak details
              _StreakSection(streak: profile.correctionStreak),
              const SizedBox(height: 20),
              _BadgeSection(badges: profile.badges),
              const SizedBox(height: 20),
              _LanguageSection(profile: profile),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Sub-widgets ──────────────────────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.profile});
  final UserProfile profile;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        CircleAvatar(
          radius: 40,
          backgroundColor: theme.colorScheme.primaryContainer,
          child: Text(
            profile.username.isNotEmpty
                ? profile.username[0].toUpperCase()
                : '?',
            style: theme.textTheme.headlineMedium?.copyWith(
              color: theme.colorScheme.onPrimaryContainer,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(profile.username, style: theme.textTheme.titleLarge),
        const SizedBox(height: 6),
        Text(
          '${langLabel(profile.nativeLanguage)} 원어민',
          style: theme.textTheme.bodyMedium
              ?.copyWith(color: theme.colorScheme.outline),
        ),
        const SizedBox(height: 8),
        Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: theme.colorScheme.secondaryContainer,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            _levelLabel(profile.correctorLevel),
            style: theme.textTheme.labelMedium?.copyWith(
              color: theme.colorScheme.onSecondaryContainer,
            ),
          ),
        ),
      ],
    );
  }

  String _levelLabel(String level) => switch (level) {
        'NATIVE' => '원어민',
        'VERIFIED_CORRECTOR' => '인증 교정자',
        'EXPERT_COACH' => '전문 코치',
        'BEGINNER' => '초급 교정자',
        'INTERMEDIATE' => '중급 교정자',
        'ADVANCED' => '고급 교정자',
        _ => level,
      };
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.profile});
  final UserProfile profile;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatCard(
            icon: Icons.local_fire_department_rounded,
            label: '스트릭',
            value: '${profile.correctionStreak}일',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            icon: Icons.star_rounded,
            label: '신뢰도',
            value: profile.reputationScore.toStringAsFixed(1),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            icon: Icons.emoji_events_rounded,
            label: '뱃지',
            value: '${profile.badges.length}개',
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard(
      {required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding:
          const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, color: theme.colorScheme.primary, size: 24),
          const SizedBox(height: 6),
          Text(value,
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold)),
          Text(label,
              style: theme.textTheme.labelSmall
                  ?.copyWith(color: theme.colorScheme.outline)),
        ],
      ),
    );
  }
}

class _ReputationSection extends StatelessWidget {
  const _ReputationSection({required this.score});
  final double score;

  Color _barColor(double s) {
    if (s >= 8) return Colors.green;
    if (s >= 6) return Colors.blue;
    if (s >= 4) return Colors.orange;
    return Colors.red;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pct = (score / 10).clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('교정 신뢰도',
            style: theme.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: pct,
                  minHeight: 8,
                  backgroundColor:
                      theme.colorScheme.surfaceContainerHighest,
                  valueColor:
                      AlwaysStoppedAnimation<Color>(_barColor(score)),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              score.toStringAsFixed(1),
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          '최근 교정에 대한 "도움됨" 평가를 기반으로 산정됩니다.',
          style: theme.textTheme.bodySmall
              ?.copyWith(color: theme.colorScheme.outline),
        ),
      ],
    );
  }
}

class _StreakSection extends StatelessWidget {
  const _StreakSection({required this.streak});
  final int streak;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('연속 교정 스트릭',
            style: theme.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '$streak',
              style: theme.textTheme.displaySmall?.copyWith(
                color: Colors.orange.shade600,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(width: 6),
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text('일 연속',
                  style: theme.textTheme.titleMedium
                      ?.copyWith(color: theme.colorScheme.outline)),
            ),
            if (streak >= 7) ...[
              const Spacer(),
              const Text('🔥', style: TextStyle(fontSize: 28)),
            ],
          ],
        ),
        if (streak == 0)
          Text('오늘 교정을 시작해서 스트릭을 쌓으세요!',
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline))
        else if (streak > 0 && streak % 7 == 0)
          Text('🎉 ${streak}일 달성! 보너스 크레딧이 지급됐어요.',
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: Colors.orange.shade700)),
      ],
    );
  }
}

class _BadgeSection extends StatelessWidget {
  const _BadgeSection({required this.badges});
  final List<UserBadge> badges;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final earnedKeys = badges.map((b) => b.badgeType).toSet();
    final allKeys = _badgeMeta.keys.toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('획득한 뱃지',
            style: theme.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        if (badges.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Column(
              children: [
                Text('🏅',
                    style: theme.textTheme.displaySmall),
                const SizedBox(height: 8),
                Text('아직 획득한 뱃지가 없어요',
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: theme.colorScheme.outline)),
                Text('교정 활동으로 뱃지를 모아보세요!',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.outline)),
              ],
            ),
          )
        else
          Column(
            children: badges.map((b) {
              final meta = _badgeMeta[b.badgeType];
              if (meta == null) return const SizedBox.shrink();
              return _BadgeTile(
                icon: meta.icon,
                label: meta.label,
                desc: meta.desc,
                earned: true,
              );
            }).toList(),
          ),

        // Unearned badges
        if (earnedKeys.length < allKeys.length) ...[
          const SizedBox(height: 8),
          Text('획득 가능한 뱃지',
              style: theme.textTheme.labelSmall
                  ?.copyWith(color: theme.colorScheme.outline)),
          const SizedBox(height: 8),
          Column(
            children: allKeys
                .where((key) => !earnedKeys.contains(key))
                .map((key) {
              final meta = _badgeMeta[key]!;
              return _BadgeTile(
                icon: meta.icon,
                label: meta.label,
                desc: meta.desc,
                earned: false,
              );
            }).toList(),
          ),
        ],
      ],
    );
  }
}

class _BadgeTile extends StatelessWidget {
  const _BadgeTile({
    required this.icon,
    required this.label,
    required this.desc,
    required this.earned,
  });

  final String icon;
  final String label;
  final String desc;
  final bool earned;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Opacity(
      opacity: earned ? 1.0 : 0.38,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Text(icon, style: const TextStyle(fontSize: 24)),
            const SizedBox(width: 14),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600)),
                Text(desc,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.outline)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LanguageSection extends StatelessWidget {
  const _LanguageSection({required this.profile});
  final UserProfile profile;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('언어 설정',
            style: theme.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        _LanguageRow(label: '모국어', languages: [profile.nativeLanguage]),
        const SizedBox(height: 8),
        _LanguageRow(
            label: '구사 가능', languages: profile.fluentLanguages),
        const SizedBox(height: 8),
        _LanguageRow(
            label: '학습 중', languages: profile.learningLanguages),
      ],
    );
  }
}

class _LanguageRow extends StatelessWidget {
  const _LanguageRow(
      {required this.label, required this.languages});
  final String label;
  final List<String> languages;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 72,
          child: Text(label,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline)),
        ),
        Expanded(
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: languages
                .map((l) => Chip(
                      label: Text(langLabel(l)),
                      materialTapTargetSize:
                          MaterialTapTargetSize.shrinkWrap,
                      visualDensity: VisualDensity.compact,
                    ))
                .toList(),
          ),
        ),
      ],
    );
  }
}
