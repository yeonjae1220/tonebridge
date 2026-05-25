import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/features/friend/domain/model/friend.dart';
import 'package:tonebridge/features/friend/domain/model/user_search_result.dart';
import 'package:tonebridge/features/friend/presentation/friend_provider.dart';
import 'package:tonebridge/features/study_session/domain/model/study_session.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';

// ── Pending Requests Banner ───────────────────────────────────────────────────

class _PendingRequestsSection extends ConsumerWidget {
  const _PendingRequestsSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pendingAsync = ref.watch(pendingFriendRequestsProvider);
    return pendingAsync.when(
      loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
      error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
      data: (requests) {
        if (requests.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
        final theme = Theme.of(context);
        return SliverToBoxAdapter(
          child: Container(
            margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            decoration: BoxDecoration(
              color: theme.colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                  child: Row(
                    children: [
                      Icon(Icons.person_add_rounded,
                          size: 18, color: theme.colorScheme.onPrimaryContainer),
                      const SizedBox(width: 6),
                      Text(
                        '친구 요청 ${requests.length}개',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: theme.colorScheme.onPrimaryContainer,
                        ),
                      ),
                    ],
                  ),
                ),
                ...requests.map(
                  (req) => _PendingRequestTile(request: req),
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _PendingRequestTile extends ConsumerStatefulWidget {
  const _PendingRequestTile({required this.request});
  final FriendRequestItem request;

  @override
  ConsumerState<_PendingRequestTile> createState() => _PendingRequestTileState();
}

class _PendingRequestTileState extends ConsumerState<_PendingRequestTile> {
  bool _accepting = false;
  bool _declining = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final id = widget.request.senderId;
    final displayName = widget.request.senderUsername.isNotEmpty
        ? widget.request.senderUsername
        : id.substring(0, id.length.clamp(0, 8));

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: theme.colorScheme.primary,
            child: Text(
              displayName[0].toUpperCase(),
              style: TextStyle(
                color: theme.colorScheme.onPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              displayName,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          if (_accepting || _declining)
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextButton(
                  style: TextButton.styleFrom(
                    foregroundColor: theme.colorScheme.onSurfaceVariant,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 44),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  onPressed: () async {
                    setState(() => _declining = true);
                    final messenger = ScaffoldMessenger.of(context);
                    final errorColor = theme.colorScheme.error;
                    try {
                      await ref
                          .read(friendListStateProvider.notifier)
                          .declineRequest(widget.request.id);
                    } catch (e) {
                      if (mounted) {
                        messenger.showSnackBar(
                          SnackBar(
                            content: const Text('요청 거절에 실패했어요. 다시 시도해 주세요.'),
                            backgroundColor: errorColor,
                          ),
                        );
                        setState(() => _declining = false);
                      }
                    }
                  },
                  child: const Text('거절', style: TextStyle(fontSize: 13)),
                ),
                const SizedBox(width: 4),
                TextButton(
                  style: TextButton.styleFrom(
                    backgroundColor: theme.colorScheme.primary,
                    foregroundColor: theme.colorScheme.onPrimary,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    minimumSize: const Size(0, 44),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  onPressed: () async {
                    setState(() => _accepting = true);
                    final messenger = ScaffoldMessenger.of(context);
                    final errorColor = theme.colorScheme.error;
                    try {
                      await ref
                          .read(friendListStateProvider.notifier)
                          .acceptRequest(widget.request.id);
                      if (mounted) {
                        messenger.showSnackBar(
                          SnackBar(content: Text('$displayName 님과 친구가 되었어요!')),
                        );
                      }
                    } catch (e) {
                      if (mounted) {
                        messenger.showSnackBar(
                          SnackBar(
                            content: const Text('요청 수락에 실패했어요. 다시 시도해 주세요.'),
                            backgroundColor: errorColor,
                          ),
                        );
                        setState(() => _accepting = false);
                      }
                    }
                  },
                  child: const Text('수락', style: TextStyle(fontSize: 13)),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class StudyPage extends ConsumerStatefulWidget {
  const StudyPage({super.key});

  @override
  ConsumerState<StudyPage> createState() => _StudyPageState();
}

class _StudyPageState extends ConsumerState<StudyPage> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sessionsAsync = ref.watch(studySessionListStateProvider);
    final friendsAsync = ref.watch(friendListStateProvider);

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      appBar: AppBar(
        title: const Text('스터디'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_outlined),
            tooltip: '친구 추가',
            onPressed: () => _showAddFriendSheet(context),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(studySessionListStateProvider);
          ref.invalidate(friendListStateProvider);
        },
        child: CustomScrollView(
          slivers: [
            const _PendingRequestsSection(),
            _FriendAvatarRow(friendsAsync: friendsAsync),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 20, 20, 8),
                child: Text('세션', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              ),
            ),
            _SessionList(sessionsAsync: sessionsAsync),
          ],
        ),
      ),
      floatingActionButton: friendsAsync.maybeWhen(
        data: (friends) => friends.isEmpty
            ? null
            : FloatingActionButton.extended(
                onPressed: () => _showCreateSessionSheet(context, friends),
                icon: const Icon(Icons.add),
                label: const Text('새 세션'),
              ),
        orElse: () => null,
      ),
    );
  }

  void _showAddFriendSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => _AddFriendSheet(
        onSend: (username) async {
          final messenger = ScaffoldMessenger.of(context);
          final errorColor = Theme.of(context).colorScheme.error;
          await ref
              .read(friendListStateProvider.notifier)
              .sendRequest(username);
          if (context.mounted) {
            messenger.showSnackBar(
              const SnackBar(content: Text('친구 요청을 보냈어요!')),
            );
          }
          return true;
        },
        onError: (e) {
          final messenger = ScaffoldMessenger.of(context);
          messenger.showSnackBar(
            SnackBar(
              content: Text(_friendErrorMessage(e)),
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
          );
        },
      ),
    );
  }

  String _friendErrorMessage(Object e) {
    final msg = e.toString();
    if (msg.contains('USER_NOT_FOUND')) return '해당 유저를 찾을 수 없어요.';
    if (msg.contains('CANNOT_ADD_SELF')) return '자기 자신에게 친구 요청을 보낼 수 없어요.';
    if (msg.contains('ALREADY_SENT') || msg.contains('FRIEND_REQUEST_ALREADY')) {
      return '이미 친구 요청을 보냈어요.';
    }
    return '오류가 발생했어요. 다시 시도해 주세요.';
  }

  void _showCreateSessionSheet(BuildContext context, List<Friend> friends) {
    Friend? selected = friends.firstOrNull;
    final titleController = TextEditingController();
    // Cache before async gaps.
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.viewInsetsOf(ctx).bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('새 스터디 세션',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              DropdownButtonFormField<Friend>(
                initialValue: selected,
                decoration: const InputDecoration(
                  labelText: '함께할 친구',
                  border: OutlineInputBorder(),
                ),
                items: friends
                    .map((f) => DropdownMenuItem(
                          value: f,
                          child: Text('${f.username} (${f.nativeLanguage})'),
                        ))
                    .toList(),
                onChanged: (f) => setSheetState(() => selected = f),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: titleController,
                decoration: const InputDecoration(
                  labelText: '세션 이름 (선택)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: selected == null
                      ? null
                      : () async {
                          final title = titleController.text.trim();
                          try {
                            final session = await ref
                                .read(studySessionListStateProvider.notifier)
                                .createSession(
                                  selected!.id,
                                  title: title.isEmpty ? null : title,
                                );
                            if (ctx.mounted) {
                              Navigator.pop(ctx);
                              router.push(AppRoute.sessionDetail(session.id));
                            }
                          } catch (e) {
                            if (ctx.mounted) {
                              messenger.showSnackBar(
                                SnackBar(content: Text(_friendErrorMessage(e))),
                              );
                            }
                          }
                        },
                  child: const Text('시작하기'),
                ),
              ),
            ],
          ),
        ),
      ),
    ).whenComplete(titleController.dispose);
  }
}

class _FriendAvatarRow extends StatelessWidget {
  const _FriendAvatarRow({required this.friendsAsync});
  final AsyncValue<List<Friend>> friendsAsync;

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, 12),
            child: Text('친구', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          ),
          SizedBox(
            height: 90,
            child: friendsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) =>
                  const Center(child: Text('친구 목록을 불러올 수 없어요')),
              data: (friends) => friends.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 20),
                      child: Text(
                        '아직 친구가 없어요. 상단 + 버튼으로 추가해보세요.',
                        style: TextStyle(color: Colors.grey),
                      ),
                    )
                  : ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: friends.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 16),
                      itemBuilder: (_, i) => _FriendAvatar(friend: friends[i]),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FriendAvatar extends ConsumerWidget {
  const _FriendAvatar({required this.friend});
  final Friend friend;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return GestureDetector(
      onLongPress: () => _confirmRemove(context, ref),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: theme.colorScheme.primaryContainer,
            child: Text(
              friend.username.isNotEmpty ? friend.username[0].toUpperCase() : '?',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: theme.colorScheme.onPrimaryContainer,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            friend.username,
            style: const TextStyle(fontSize: 12),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Future<void> _confirmRemove(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('친구 삭제'),
        content: Text('${friend.username} 님을 친구 목록에서 삭제할까요?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('삭제'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(friendListStateProvider.notifier)
          .removeFriend(friend.id);
      if (context.mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text('${friend.username} 님을 친구 목록에서 삭제했어요.')),
        );
      }
    } on Exception {
      if (context.mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: const Text('친구 삭제에 실패했어요. 다시 시도해 주세요.'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }
}

class _SessionList extends StatelessWidget {
  const _SessionList({required this.sessionsAsync});
  final AsyncValue<List<StudySession>> sessionsAsync;

  @override
  Widget build(BuildContext context) {
    return sessionsAsync.when(
      loading: () => const SliverFillRemaining(
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => SliverFillRemaining(
        child: Center(child: Text('오류: $e')),
      ),
      data: (sessions) => sessions.isEmpty
          ? const SliverFillRemaining(
              child: Center(
                child: Text(
                  '아직 세션이 없어요.\n친구와 함께 스터디를 시작해보세요!',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
              ),
            )
          : SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
              sliver: SliverList.builder(
                itemCount: sessions.length,
                itemBuilder: (_, i) => _SessionCard(session: sessions[i]),
              ),
            ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.session});
  final StudySession session;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = session.title ?? '스터디 세션';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: theme.colorScheme.secondaryContainer,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            Icons.menu_book_rounded,
            color: theme.colorScheme.onSecondaryContainer,
          ),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(
          '${session.memberIds.length}명 참여 중',
          style: TextStyle(color: theme.colorScheme.outline),
        ),
        trailing: Icon(Icons.chevron_right_rounded,
            color: theme.colorScheme.outline),
        onTap: () => context.push(AppRoute.sessionDetail(session.id)),
      ),
    );
  }
}

// ── Add Friend Bottom Sheet with Autocomplete ─────────────────────────────────

class _AddFriendSheet extends ConsumerStatefulWidget {
  const _AddFriendSheet({required this.onSend, required this.onError});

  final Future<bool> Function(String username) onSend;
  final void Function(Object error) onError;

  @override
  ConsumerState<_AddFriendSheet> createState() => _AddFriendSheetState();
}

class _AddFriendSheetState extends ConsumerState<_AddFriendSheet> {
  final _controller = TextEditingController();
  String _query = '';
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send(String username) async {
    if (username.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final ok = await widget.onSend(username);
      if (ok && mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        setState(() => _sending = false);
        widget.onError(e);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
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
          const Text(
            '친구 추가',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: '유저명 검색',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.search_rounded),
            ),
            onChanged: (v) => setState(() => _query = v.trim()),
            onSubmitted: (v) => _send(v.trim()),
          ),
          if (_query.isNotEmpty) ...[
            const SizedBox(height: 8),
            searchAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: LinearProgressIndicator(),
              ),
              error: (_, __) => const SizedBox.shrink(),
              data: (results) {
                if (results.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      '검색 결과가 없습니다.',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.outline),
                    ),
                  );
                }
                return Column(
                  children: results
                      .map((u) => _UserSuggestionTile(
                            user: u,
                            onTap: () => _send(u.username),
                            sending: _sending,
                          ))
                      .toList(),
                );
              },
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
                  : const Text('요청 보내기'),
            ),
          ),
        ],
      ),
    );
  }
}

class _UserSuggestionTile extends StatelessWidget {
  const _UserSuggestionTile({
    required this.user,
    required this.onTap,
    required this.sending,
  });

  final UserSearchResult user;
  final VoidCallback onTap;
  final bool sending;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: sending ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        child: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: theme.colorScheme.primaryContainer,
              child: Text(
                user.username[0].toUpperCase(),
                style: TextStyle(
                  color: theme.colorScheme.onPrimaryContainer,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.username,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    user.nativeLanguage,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.outline),
                  ),
                ],
              ),
            ),
            Icon(Icons.person_add_rounded,
                size: 20, color: theme.colorScheme.primary),
          ],
        ),
      ),
    );
  }
}
