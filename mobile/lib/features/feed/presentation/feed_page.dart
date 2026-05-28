import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';
import 'package:tonebridge/features/feed/presentation/feed_provider.dart';
import 'package:tonebridge/features/feed/presentation/widgets/correction_request_card.dart';
import 'package:tonebridge/features/profile/domain/model/user_profile.dart';
import 'package:tonebridge/features/profile/presentation/profile_provider.dart';

class FeedPage extends ConsumerStatefulWidget {
  const FeedPage({super.key});

  @override
  ConsumerState<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends ConsumerState<FeedPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final profileAsync = ref.watch(userProfileProvider);
    final streak = profileAsync.whenOrNull(data: (p) => p.correctionStreak);

    return Scaffold(
      appBar: AppBar(
        title: const Text('피드'),
        actions: [
          // Streak badge
          if (streak != null && streak > 0)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: GestureDetector(
                onTap: () => context.push(AppRoute.profile),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    border: Border.all(color: Colors.orange.shade200),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '🔥 ${streak}일',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: Colors.orange.shade800,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          // Request button
          Padding(
            padding: const EdgeInsets.only(right: 12, top: 8, bottom: 8),
            child: FilledButton(
              onPressed: () => context.push(AppRoute.request),
              style: FilledButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 0),
                  visualDensity: VisualDensity.compact),
              child: const Text('요청하기'),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: '교정 요청'),
            Tab(text: '내 요청'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _FeedTab(profileAsync: profileAsync),
          const _MyRequestsTab(),
        ],
      ),
    );
  }
}

class _FeedTab extends ConsumerWidget {
  const _FeedTab({required this.profileAsync});
  final AsyncValue<UserProfile> profileAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedAsync = ref.watch(feedStateProvider);

    // Collect codes the current user can correct
    final correctorVariants = profileAsync.whenOrNull(data: (p) {
      return <String>{
        p.nativeLanguage,
        ...p.fluentLanguages,
      };
    }) ?? <String>{};

    return feedAsync.when(
      loading: () => _LoadingSkeleton(),
      error: (e, _) => _ErrorView(
        message: e.toString(),
        onRetry: () =>
            ref.read(feedStateProvider.notifier).refresh(),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const _EmptyView(
            icon: Icons.inbox_rounded,
            message: '교정 가능한 요청이 없습니다.\n잠시 후 다시 확인해보세요.',
          );
        }
        return RefreshIndicator(
          onRefresh: () =>
              ref.read(feedStateProvider.notifier).refresh(),
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              final isMatch = item.targetVariant != null &&
                  correctorVariants.contains(item.targetVariant);
              return CorrectionRequestCard(
                item: item,
                isVariantMatch: isMatch,
                onTap: () => context.push(AppRoute.correct(item.id)),
              );
            },
          ),
        );
      },
    );
  }
}

class _MyRequestsTab extends ConsumerWidget {
  const _MyRequestsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final myAsync = ref.watch(myRequestsStateProvider);
    return myAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _ErrorView(
        message: e.toString(),
        onRetry: () =>
            ref.read(myRequestsStateProvider.notifier).refresh(),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const _EmptyView(
            icon: Icons.edit_note_rounded,
            message: '아직 교정 요청이 없습니다.\n새 요청을 작성해보세요.',
          );
        }
        return RefreshIndicator(
          onRefresh: () =>
              ref.read(myRequestsStateProvider.notifier).refresh(),
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              return CorrectionRequestCard(
                item: item,
                onTap: () => context.push(AppRoute.result(item.id)),
                onEdit: item.status == 'PENDING'
                    ? () => _showEditRequestSheet(context, ref, item)
                    : null,
                onDelete: item.status == 'PENDING'
                    ? () => _confirmDeleteRequest(context, ref, item.id)
                    : null,
              );
            },
          ),
        );
      },
    );
  }

  Future<void> _confirmDeleteRequest(
    BuildContext context,
    WidgetRef ref,
    String requestId,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('요청 삭제'),
        content: const Text('이 첨삭 요청을 삭제할까요? 목록에서 숨겨집니다.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            child: const Text('삭제'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(myRequestsStateProvider.notifier).deleteRequest(requestId);
      messenger.showSnackBar(const SnackBar(content: Text('요청을 삭제했어요')));
    } on Exception catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('삭제 실패: $e')));
    }
  }

  void _showEditRequestSheet(
    BuildContext context,
    WidgetRef ref,
    CorrectionRequestItem item,
  ) {
    final contentController = TextEditingController(text: item.contentText ?? '');
    final contextController = TextEditingController(text: item.context ?? '');
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('요청 수정',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            if (item.type == 'TEXT') ...[
              const SizedBox(height: 16),
              TextField(
                controller: contentController,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: '원문',
                  border: OutlineInputBorder(),
                ),
                maxLines: 4,
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: contextController,
              decoration: const InputDecoration(
                labelText: '상황 설명',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () async {
                  final navigator = Navigator.of(context);
                  final messenger = ScaffoldMessenger.of(context);
                  try {
                    await ref.read(myRequestsStateProvider.notifier).updateRequest(
                          requestId: item.id,
                          targetLanguage: item.targetLanguage,
                          targetVariant: item.targetVariant,
                          contentText: item.type == 'TEXT'
                              ? contentController.text.trim()
                              : null,
                          context: contextController.text.trim().isEmpty
                              ? null
                              : contextController.text.trim(),
                          feedbackGoals: item.feedbackGoals,
                        );
                    navigator.pop();
                    messenger.showSnackBar(
                        const SnackBar(content: Text('요청을 수정했어요')));
                  } on Exception catch (e) {
                    messenger.showSnackBar(SnackBar(content: Text('수정 실패: $e')));
                  }
                },
                child: const Text('저장'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Shared sub-widgets ───────────────────────────────────────────────────────

class _LoadingSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      itemCount: 4,
      itemBuilder: (_, __) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Container(
          height: 110,
          decoration: BoxDecoration(
            color: theme.colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded,
                size: 48, color: theme.colorScheme.error),
            const SizedBox(height: 12),
            Text('오류가 발생했습니다', style: theme.textTheme.titleMedium),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('다시 시도')),
          ],
        ),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView({required this.icon, required this.message});
  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 56, color: theme.colorScheme.outline),
          const SizedBox(height: 16),
          Text(
            message,
            style: theme.textTheme.bodyLarge?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
