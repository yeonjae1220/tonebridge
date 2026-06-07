import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
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
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final strings = ref.watch(tProvider);
    final profileAsync = ref.watch(userProfileProvider);
    final streak = profileAsync.whenOrNull(data: (p) => p.correctionStreak);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(strings.feedTitle),
            Text(
              strings.feedSubtitle,
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
        actions: [
          // Streak badge
          if (streak != null && streak > 0)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: GestureDetector(
                onTap: () => context.push(AppRoute.profile),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    border: Border.all(color: Colors.orange.shade200),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '🔥 ${strings.streakDays(streak)}',
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
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 0,
                ),
                visualDensity: VisualDensity.compact,
              ),
              child: Text(strings.requestAction),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(text: strings.correctionRequests),
            Tab(text: strings.myRequests),
            const Tab(text: '완료됨'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _FeedTab(profileAsync: profileAsync),
          const _MyRequestsTab(),
          const _DoneRequestsTab(),
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
    final strings = ref.watch(tProvider);
    final feedAsync = ref.watch(feedStateProvider);

    // Collect codes the current user can correct
    final correctorVariants =
        profileAsync.whenOrNull(
          data: (p) {
            return <String>{p.nativeLanguage, ...p.fluentLanguages};
          },
        ) ??
        <String>{};

    return feedAsync.when(
      loading: () => _LoadingSkeleton(),
      error: (e, _) => _ErrorView(
        message: e.toString(),
        onRetry: () => ref.read(feedStateProvider.notifier).refresh(),
      ),
      data: (items) {
        if (items.isEmpty) {
          return _EmptyView(
            icon: Icons.inbox_rounded,
            message: strings.noCorrectableRequests,
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.read(feedStateProvider.notifier).refresh(),
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              final isMatch =
                  item.targetVariant != null &&
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
    final strings = ref.watch(tProvider);
    final myAsync = ref.watch(myRequestsStateProvider);
    return myAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _ErrorView(
        message: e.toString(),
        onRetry: () => ref.read(myRequestsStateProvider.notifier).refresh(),
      ),
      data: (items) {
        final activeItems = items
            .where(
              (item) =>
                  item.status == 'PENDING' || item.status == 'IN_PROGRESS',
            )
            .toList();
        if (activeItems.isEmpty) {
          return _EmptyView(
            icon: Icons.edit_note_rounded,
            message: strings.noMyRequests,
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.read(myRequestsStateProvider.notifier).refresh(),
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: activeItems.length,
            itemBuilder: (context, index) {
              final item = activeItems[index];
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
    final strings = ref.read(tProvider);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(strings.requestDeleteTitle),
        content: Text(strings.requestDeleteConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(strings.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            child: Text(strings.delete),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(myRequestsStateProvider.notifier).deleteRequest(requestId);
      messenger.showSnackBar(SnackBar(content: Text(strings.requestDeleted)));
    } on Exception catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(strings.deleteFailed(e))));
    }
  }

  void _showEditRequestSheet(
    BuildContext context,
    WidgetRef ref,
    CorrectionRequestItem item,
  ) {
    final strings = ref.read(tProvider);
    final contentController = TextEditingController(
      text: item.contentText ?? '',
    );
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
            Text(
              strings.requestEditTitle,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            if (item.type == 'TEXT') ...[
              const SizedBox(height: 16),
              TextField(
                controller: contentController,
                autofocus: true,
                decoration: InputDecoration(
                  labelText: strings.originalText,
                  border: const OutlineInputBorder(),
                ),
                maxLines: 4,
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: contextController,
              decoration: InputDecoration(
                labelText: strings.contextDescription,
                border: const OutlineInputBorder(),
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
                    await ref
                        .read(myRequestsStateProvider.notifier)
                        .updateRequest(
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
                      SnackBar(content: Text(strings.requestUpdated)),
                    );
                  } on Exception catch (e) {
                    messenger.showSnackBar(
                      SnackBar(content: Text(strings.editFailed(e))),
                    );
                  }
                },
                child: Text(strings.save),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DoneRequestsTab extends ConsumerWidget {
  const _DoneRequestsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final myAsync = ref.watch(myRequestsStateProvider);
    return myAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _ErrorView(
        message: e.toString(),
        onRetry: () => ref.read(myRequestsStateProvider.notifier).refresh(),
      ),
      data: (items) {
        final doneItems = items
            .where(
              (item) =>
                  item.status == 'COMPLETED' || item.status == 'AI_COMPLETED',
            )
            .toList();
        if (doneItems.isEmpty) {
          return const _EmptyView(
            icon: Icons.check_circle_outline_rounded,
            message: '완료된 요청이 아직 없습니다.',
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.read(myRequestsStateProvider.notifier).refresh(),
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: doneItems.length,
            itemBuilder: (context, index) {
              final item = doneItems[index];
              return CorrectionRequestCard(
                item: item,
                onTap: () => context.push(AppRoute.result(item.id)),
              );
            },
          ),
        );
      },
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

class _ErrorView extends ConsumerWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final strings = ref.watch(tProvider);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline_rounded,
              size: 48,
              color: theme.colorScheme.error,
            ),
            const SizedBox(height: 12),
            Text(strings.errorOccurred, style: theme.textTheme.titleMedium),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: Text(strings.retry)),
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
