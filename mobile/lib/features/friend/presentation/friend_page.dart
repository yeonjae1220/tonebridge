import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/features/friend/domain/model/friend.dart';
import 'package:tonebridge/features/friend/domain/model/user_search_result.dart';
import 'package:tonebridge/features/friend/presentation/friend_provider.dart';

class FriendPage extends ConsumerWidget {
  const FriendPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = ref.watch(tProvider);
    final friendsAsync = ref.watch(friendListStateProvider);
    final pendingAsync = ref.watch(pendingFriendRequestsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(strings.friends),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_outlined),
            tooltip: strings.addFriend,
            onPressed: () => _showAddFriendSheet(context, ref),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(pendingFriendRequestsProvider);
          await ref.read(friendListStateProvider.notifier).refresh();
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
          children: [
            pendingAsync.when(
              loading: () => const SizedBox.shrink(),
              error: (_, _) => const SizedBox.shrink(),
              data: (requests) => requests.isEmpty
                  ? const SizedBox.shrink()
                  : _PendingRequestsCard(requests: requests),
            ),
            const SizedBox(height: 12),
            friendsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, _) => _EmptyState(
                icon: Icons.error_outline_rounded,
                title: strings.friendsLoadFailed,
                subtitle: strings.genericError,
              ),
              data: (friends) => friends.isEmpty
                  ? _EmptyState(
                      icon: Icons.people_outline_rounded,
                      title: strings.noFriends,
                      subtitle: strings.addFriend,
                    )
                  : Column(
                      children: friends
                          .map((friend) => _FriendTile(friend: friend))
                          .toList(),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddFriendSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const _AddFriendSheet(),
    );
  }
}

class _PendingRequestsCard extends ConsumerWidget {
  const _PendingRequestsCard({required this.requests});
  final List<FriendRequestItem> requests;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final strings = ref.watch(tProvider);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              strings.friendRequestCount(requests.length),
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            ...requests.map(
              (request) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: theme.colorScheme.primaryContainer,
                  child: Text(
                    _initial(request.senderUsername),
                    style: TextStyle(
                      color: theme.colorScheme.onPrimaryContainer,
                    ),
                  ),
                ),
                title: Text(
                  request.senderUsername.isEmpty ? '-' : request.senderUsername,
                ),
                trailing: Wrap(
                  spacing: 6,
                  children: [
                    TextButton(
                      onPressed: () => ref
                          .read(friendListStateProvider.notifier)
                          .declineRequest(request.id),
                      child: Text(strings.decline),
                    ),
                    FilledButton(
                      onPressed: () => ref
                          .read(friendListStateProvider.notifier)
                          .acceptRequest(request.id),
                      child: Text(strings.accept),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FriendTile extends ConsumerWidget {
  const _FriendTile({required this.friend});
  final Friend friend;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final strings = ref.watch(tProvider);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: theme.colorScheme.primaryContainer,
          child: Text(
            _initial(friend.username),
            style: TextStyle(
              color: theme.colorScheme.onPrimaryContainer,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        title: Text(friend.username),
        subtitle: Text(friend.nativeLanguage),
        trailing: IconButton(
          icon: const Icon(Icons.delete_outline_rounded),
          tooltip: strings.delete,
          onPressed: () async {
            final confirmed = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: Text(strings.delete),
                content: Text(strings.removeFriendConfirm(friend.username)),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(ctx).pop(false),
                    child: Text(strings.cancel),
                  ),
                  FilledButton(
                    onPressed: () => Navigator.of(ctx).pop(true),
                    child: Text(strings.delete),
                  ),
                ],
              ),
            );
            if (confirmed ?? false) {
              await ref
                  .read(friendListStateProvider.notifier)
                  .removeFriend(friend.id);
            }
          },
        ),
      ),
    );
  }
}

class _AddFriendSheet extends ConsumerStatefulWidget {
  const _AddFriendSheet();

  @override
  ConsumerState<_AddFriendSheet> createState() => _AddFriendSheetState();
}

class _AddFriendSheetState extends ConsumerState<_AddFriendSheet> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _query = '';
  bool _sending = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send(String username) async {
    if (username.isEmpty || _sending) return;
    setState(() => _sending = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(friendListStateProvider.notifier).sendRequest(username);
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(ref.read(tProvider).friendRequestSent)),
      );
      Navigator.of(context).pop();
    } catch (_) {
      if (!mounted) return;
      setState(() => _sending = false);
      messenger.showSnackBar(
        SnackBar(
          content: Text(ref.read(tProvider).genericError),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = ref.watch(tProvider);
    final searchAsync = ref.watch(userSearchProvider(_query));

    return Padding(
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
            strings.addFriend,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            autofocus: true,
            decoration: InputDecoration(
              labelText: strings.usernameSearch,
              border: const OutlineInputBorder(),
              prefixIcon: const Icon(Icons.search_rounded),
            ),
            onChanged: (value) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 300), () {
                setState(() => _query = value.trim());
              });
            },
            onSubmitted: (value) => _send(value.trim()),
          ),
          if (_query.isNotEmpty) ...[
            const SizedBox(height: 8),
            searchAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, _) => Text(strings.searchFailed),
              data: (results) => Column(
                children: results
                    .map(
                      (user) => _UserSuggestionTile(
                        user: user,
                        onTap: () => _send(user.username),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _sending ? null : () => _send(_controller.text.trim()),
              child: _sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(strings.sendRequest),
            ),
          ),
        ],
      ),
    );
  }
}

class _UserSuggestionTile extends StatelessWidget {
  const _UserSuggestionTile({required this.user, required this.onTap});
  final UserSearchResult user;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(child: Text(_initial(user.username))),
      title: Text(user.username),
      subtitle: Text(user.nativeLanguage),
      trailing: const Icon(Icons.person_add_rounded),
      onTap: onTap,
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 72),
      child: Column(
        children: [
          Icon(icon, size: 40, color: theme.colorScheme.outline),
          const SizedBox(height: 12),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(color: theme.colorScheme.outline)),
        ],
      ),
    );
  }
}

String _initial(String value) => value.isEmpty ? '?' : value[0].toUpperCase();
