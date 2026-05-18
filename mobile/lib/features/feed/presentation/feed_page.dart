import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/features/feed/presentation/feed_provider.dart';
import 'package:tonebridge/features/feed/presentation/widgets/correction_request_card.dart';

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
    return Scaffold(
      appBar: AppBar(
        title: const Text('피드'),
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
        children: const [
          _FeedTab(),
          _MyRequestsTab(),
        ],
      ),
    );
  }
}

class _FeedTab extends ConsumerWidget {
  const _FeedTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedAsync = ref.watch(feedStateProvider);
    return feedAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _ErrorView(
        message: e.toString(),
        onRetry: () => ref.read(feedStateProvider.notifier).refresh(),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const _EmptyView(
            icon: Icons.inbox_rounded,
            message: '교정 가능한 요청이 없습니다.\n잠시 후 다시 확인해보세요.',
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.read(feedStateProvider.notifier).refresh(),
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              return CorrectionRequestCard(
                item: item,
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
        onRetry: () => ref.read(myRequestsStateProvider.notifier).refresh(),
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
              );
            },
          ),
        );
      },
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
            Text(
              '오류가 발생했습니다',
              style: theme.textTheme.titleMedium,
            ),
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
