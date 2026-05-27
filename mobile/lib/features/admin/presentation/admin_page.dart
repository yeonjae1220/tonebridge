import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/features/admin/data/admin_repository.dart';
import 'package:tonebridge/features/admin/domain/admin_models.dart';

const _languageLabels = {
  'ko': '한국어',
  'ja': '일본어',
  'zh': '중국어',
  'en': '영어',
  'es': '스페인어',
  'fr': '프랑스어',
};

class AdminPage extends ConsumerWidget {
  const AdminPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(adminStatsProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('관리자 대시보드'),
        actions: [
          IconButton(
            tooltip: '사용자 관리',
            onPressed: () => context.go('/admin/users'),
            icon: const Icon(Icons.manage_accounts_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(adminStatsProvider),
        child: statsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _AdminErrorView(
            error: error,
            onRetry: () => ref.invalidate(adminStatsProvider),
          ),
          data: (stats) => ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _StatsGrid(stats: stats),
              const SizedBox(height: 24),
              Text(
                '언어별 대기 요청',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              _PendingByLanguage(stats: stats),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});

  final AdminStats stats;

  @override
  Widget build(BuildContext context) {
    final passRate = (stats.qualityPassRate * 100).round();
    return GridView.count(
      crossAxisCount: MediaQuery.sizeOf(context).width >= 640 ? 4 : 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.25,
      children: [
        _StatTile(label: '전체 요청', value: '${stats.totalRequests}'),
        _StatTile(label: '대기 중', value: '${stats.pendingRequests}'),
        _StatTile(label: '완료됨', value: '${stats.completedRequests}'),
        _StatTile(label: 'AI 품질 통과율', value: '$passRate%'),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      color: theme.colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label, style: theme.textTheme.labelMedium),
            const SizedBox(height: 8),
            Text(
              value,
              style: theme.textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PendingByLanguage extends StatelessWidget {
  const _PendingByLanguage({required this.stats});

  final AdminStats stats;

  @override
  Widget build(BuildContext context) {
    final entries = stats.pendingByLanguage.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    if (entries.isEmpty) {
      return const Card(
        elevation: 0,
        child: Padding(
          padding: EdgeInsets.all(20),
          child: Text('대기 중인 요청이 없습니다.'),
        ),
      );
    }

    final max = entries.first.value;
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            for (final entry in entries)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    SizedBox(
                      width: 72,
                      child: Text(_languageLabels[entry.key] ?? entry.key),
                    ),
                    Expanded(
                      child: LinearProgressIndicator(
                        value: max == 0 ? 0 : entry.value / max,
                        minHeight: 8,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                    const SizedBox(width: 12),
                    SizedBox(
                      width: 36,
                      child: Text(
                        '${entry.value}',
                        textAlign: TextAlign.end,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _AdminErrorView extends StatelessWidget {
  const _AdminErrorView({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final status = error is DioException
        ? (error as DioException).response?.statusCode
        : null;
    final message = status == 403
        ? '관리자 권한이 없습니다. 로그아웃 후 관리자 계정으로 다시 로그인해 주세요.'
        : '관리자 정보를 불러올 수 없습니다.';
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 80),
        Icon(
          status == 403
              ? Icons.admin_panel_settings_outlined
              : Icons.error_outline_rounded,
          size: 56,
        ),
        const SizedBox(height: 16),
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 20),
        FilledButton(onPressed: onRetry, child: const Text('다시 시도')),
      ],
    );
  }
}
