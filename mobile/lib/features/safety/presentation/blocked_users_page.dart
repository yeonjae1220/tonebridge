import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/features/safety/domain/safety_repository.dart';
import 'package:tonebridge/features/safety/presentation/blocked_users_provider.dart';
import 'package:tonebridge/features/safety/presentation/safety_strings.dart';

class BlockedUsersPage extends ConsumerWidget {
  const BlockedUsersPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = ref.watch(tProvider);
    final blockedAsync = ref.watch(blockedUsersProvider);

    return Scaffold(
      appBar: AppBar(title: Text(strings.blockedUsers)),
      body: blockedAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(strings.blockedUsersLoadFailed),
              TextButton.icon(
                onPressed: () => ref.invalidate(blockedUsersProvider),
                icon: const Icon(Icons.refresh_rounded),
                label: Text(strings.retry),
              ),
            ],
          ),
        ),
        data: (state) {
          if (state.users.isEmpty) {
            return Center(child: Text(strings.noBlockedUsers));
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              for (final user in state.users)
                _BlockedUserTile(key: ValueKey(user.userId), user: user),
              if (state.hasMore)
                TextButton(
                  onPressed: () =>
                      ref.read(blockedUsersProvider.notifier).loadMore(),
                  child: Text(strings.loadMore),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _BlockedUserTile extends ConsumerStatefulWidget {
  const _BlockedUserTile({required this.user, super.key});
  final BlockedUser user;

  @override
  ConsumerState<_BlockedUserTile> createState() => _BlockedUserTileState();
}

class _BlockedUserTileState extends ConsumerState<_BlockedUserTile> {
  bool _busy = false;

  Future<void> _unblock() async {
    final strings = ref.read(tProvider);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(strings.unblockConfirm(widget.user.username)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(strings.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(strings.unblock),
          ),
        ],
      ),
    );
    if (!(confirmed ?? false) || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(blockedUsersProvider.notifier).unblock(widget.user.userId);
    } on Exception catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(strings.genericError)));
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = ref.watch(tProvider);
    final name = widget.user.username.isEmpty ? '-' : widget.user.username;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(child: Text(name[0].toUpperCase())),
        title: Text(name),
        trailing: _busy
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : TextButton(onPressed: _unblock, child: Text(strings.unblock)),
      ),
    );
  }
}
