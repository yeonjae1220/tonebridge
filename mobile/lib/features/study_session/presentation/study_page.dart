import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
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
    final strings = ref.watch(tProvider);
    final pendingAsync = ref.watch(pendingFriendRequestsProvider);
    return pendingAsync.when(
      loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
      error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
      data: (requests) {
        if (requests.isEmpty) {
          return const SliverToBoxAdapter(child: SizedBox.shrink());
        }
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
                      Icon(
                        Icons.person_add_rounded,
                        size: 18,
                        color: theme.colorScheme.onPrimaryContainer,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        strings.friendRequestCount(requests.length),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: theme.colorScheme.onPrimaryContainer,
                        ),
                      ),
                    ],
                  ),
                ),
                ...requests.map((req) => _PendingRequestTile(request: req)),
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
  ConsumerState<_PendingRequestTile> createState() =>
      _PendingRequestTileState();
}

class _PendingRequestTileState extends ConsumerState<_PendingRequestTile> {
  bool _accepting = false;
  bool _declining = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final strings = ref.watch(tProvider);
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
                            content: Text(strings.friendRequestDeclineFailed),
                            backgroundColor: errorColor,
                          ),
                        );
                        setState(() => _declining = false);
                      }
                    }
                  },
                  child: Text(
                    strings.decline,
                    style: const TextStyle(fontSize: 13),
                  ),
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
                          SnackBar(
                            content: Text(strings.friendAccepted(displayName)),
                          ),
                        );
                      }
                    } catch (e) {
                      if (mounted) {
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text(strings.friendRequestAcceptFailed),
                            backgroundColor: errorColor,
                          ),
                        );
                        setState(() => _accepting = false);
                      }
                    }
                  },
                  child: Text(
                    strings.accept,
                    style: const TextStyle(fontSize: 13),
                  ),
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
    final strings = ref.watch(tProvider);
    final sessionsAsync = ref.watch(studySessionListStateProvider);
    final friendsAsync = ref.watch(friendListStateProvider);

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      appBar: AppBar(
        title: Text(strings.studyTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_outlined),
            tooltip: strings.addFriend,
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
            SliverToBoxAdapter(
              child: _TodayStudyPanel(
                sessionsAsync: sessionsAsync,
                friendsAsync: friendsAsync,
                onOpenPersonal: () => _openPersonalPractice(context),
                onStartWithFriend: () {
                  final friends =
                      friendsAsync.asData?.value ?? const <Friend>[];
                  if (friends.isEmpty) {
                    _showAddFriendSheet(context);
                  } else {
                    _showCreateSessionSheet(context, friends);
                  }
                },
              ),
            ),
            _FriendAvatarRow(friendsAsync: friendsAsync),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                child: Text(
                  strings.sessions,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
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
                label: Text(strings.newSession),
              ),
        orElse: () => null,
      ),
    );
  }

  void _showAddFriendSheet(BuildContext context) {
    final strings = ref.read(tProvider);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => _AddFriendSheet(
        onSend: (username) async {
          final messenger = ScaffoldMessenger.of(context);
          await ref
              .read(friendListStateProvider.notifier)
              .sendRequest(username);
          if (context.mounted) {
            messenger.showSnackBar(
              SnackBar(content: Text(strings.friendRequestSent)),
            );
          }
          return true;
        },
        onError: (e) {
          final messenger = ScaffoldMessenger.of(context);
          messenger.showSnackBar(
            SnackBar(
              content: Text(_friendErrorMessage(e, strings)),
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
          );
        },
      ),
    );
  }

  String _friendErrorMessage(Object e, ToneBridgeStrings strings) {
    final msg = e.toString();
    if (msg.contains('USER_NOT_FOUND')) return strings.friendNotFound;
    if (msg.contains('CANNOT_ADD_SELF')) return strings.cannotAddSelf;
    if (msg.contains('ALREADY_SENT') ||
        msg.contains('FRIEND_REQUEST_ALREADY')) {
      return strings.alreadySentFriendRequest;
    }
    return strings.genericError;
  }

  void _showCreateSessionSheet(BuildContext context, List<Friend> friends) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _CreateSessionSheet(friends: friends),
    );
  }

  Future<void> _openPersonalPractice(BuildContext context) async {
    final sessions =
        ref.read(studySessionListStateProvider).asData?.value ?? [];
    StudySession? personal;
    for (final session in sessions) {
      if (session.status == 'ACTIVE' && session.memberIds.length == 1) {
        personal = session;
        break;
      }
    }
    if (personal != null) {
      context.push(AppRoute.sessionDetail(personal.id));
      return;
    }

    final messenger = ScaffoldMessenger.of(context);
    try {
      final session = await ref
          .read(studySessionListStateProvider.notifier)
          .createSession(null, title: '내 연습장');
      if (context.mounted) {
        context.push(AppRoute.sessionDetail(session.id));
      }
    } catch (_) {
      if (context.mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(ref.read(tProvider).genericError),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }
}

class _TodayStudyPanel extends StatelessWidget {
  const _TodayStudyPanel({
    required this.sessionsAsync,
    required this.friendsAsync,
    required this.onOpenPersonal,
    required this.onStartWithFriend,
  });

  final AsyncValue<List<StudySession>> sessionsAsync;
  final AsyncValue<List<Friend>> friendsAsync;
  final VoidCallback onOpenPersonal;
  final VoidCallback onStartWithFriend;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sessions = sessionsAsync.asData?.value ?? const <StudySession>[];
    final friends = friendsAsync.asData?.value ?? const <Friend>[];
    final activeSessions = sessions
        .where((session) => session.status == 'ACTIVE')
        .length;
    final todoCount = activeSessions + friends.length;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '오늘의 스터디',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        activeSessions == 0
                            ? '떠오른 표현을 먼저 내 연습장에 기록해보세요.'
                            : '진행 중인 연습과 기록할 표현을 한 곳에 모았어요.',
                        style: TextStyle(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$todoCount',
                    style: TextStyle(
                      color: theme.colorScheme.onPrimary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 2.4,
            children: [
              _QuickActionButton(
                icon: Icons.edit_note_rounded,
                label: '글 작성',
                onTap: onOpenPersonal,
              ),
              _QuickActionButton(
                icon: Icons.mic_rounded,
                label: '녹음',
                onTap: onOpenPersonal,
              ),
              _QuickActionButton(
                icon: Icons.people_rounded,
                label: '친구에게 보내기',
                onTap: onStartWithFriend,
              ),
              _QuickActionButton(
                icon: Icons.forum_rounded,
                label: '커뮤니티에 요청',
                onTap: () => context.push(AppRoute.request),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 18),
      label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
      style: OutlinedButton.styleFrom(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        foregroundColor: theme.colorScheme.onSurface,
      ),
    );
  }
}

class _FriendAvatarRow extends ConsumerWidget {
  const _FriendAvatarRow({required this.friendsAsync});
  final AsyncValue<List<Friend>> friendsAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = ref.watch(tProvider);
    return SliverToBoxAdapter(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
            child: Text(
              strings.friends,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
          ),
          SizedBox(
            height: 90,
            child: friendsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => Center(child: Text(strings.friendsLoadFailed)),
              data: (friends) => friends.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Text(
                        strings.noFriends,
                        style: const TextStyle(color: Colors.grey),
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
              friend.username.isNotEmpty
                  ? friend.username[0].toUpperCase()
                  : '?',
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
    final strings = ref.read(tProvider);
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
    if (confirmed != true || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(friendListStateProvider.notifier).removeFriend(friend.id);
      if (context.mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text(strings.friendRemoved(friend.username))),
        );
      }
    } on Exception {
      if (context.mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(strings.removeFriendFailed),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }
}

class _SessionList extends ConsumerWidget {
  const _SessionList({required this.sessionsAsync});
  final AsyncValue<List<StudySession>> sessionsAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = ref.watch(tProvider);
    return sessionsAsync.when(
      loading: () => const SliverFillRemaining(
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => SliverFillRemaining(
        child: Center(child: Text(strings.errorWithDetail(e))),
      ),
      data: (sessions) => sessions.isEmpty
          ? SliverFillRemaining(
              child: Center(
                child: Text(
                  strings.noSessions,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.grey),
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

class _SessionCard extends ConsumerWidget {
  const _SessionCard({required this.session});
  final StudySession session;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final strings = ref.watch(tProvider);
    final title = session.title ?? strings.defaultSessionTitle;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 12,
        ),
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
          strings.participantCount(session.memberIds.length),
          style: TextStyle(color: theme.colorScheme.outline),
        ),
        trailing: Icon(
          Icons.chevron_right_rounded,
          color: theme.colorScheme.outline,
        ),
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
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send(String username) async {
    if (username.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final ok = await widget.onSend(username);
      if (ok && mounted) {
        Navigator.of(context).pop();
      } else if (mounted) {
        setState(() => _sending = false);
      }
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
            onChanged: (v) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 300), () {
                setState(() => _query = v.trim());
              });
            },
            onSubmitted: (v) => _send(v.trim()),
          ),
          if (_query.isNotEmpty) ...[
            const SizedBox(height: 8),
            searchAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: LinearProgressIndicator(),
              ),
              error: (_, __) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  strings.searchFailed,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.error,
                  ),
                ),
              ),
              data: (results) {
                if (results.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      strings.noSearchResults,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.outline,
                      ),
                    ),
                  );
                }
                return Column(
                  children: results
                      .map(
                        (u) => _UserSuggestionTile(
                          user: u,
                          onTap: () => _send(u.username),
                          sending: _sending,
                        ),
                      )
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
                  : Text(strings.sendRequest),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Create Session Bottom Sheet ───────────────────────────────────────────────

class _CreateSessionSheet extends ConsumerStatefulWidget {
  const _CreateSessionSheet({required this.friends});
  final List<Friend> friends;

  @override
  ConsumerState<_CreateSessionSheet> createState() =>
      _CreateSessionSheetState();
}

class _CreateSessionSheetState extends ConsumerState<_CreateSessionSheet> {
  // Non-nullable: this sheet is only opened when friends.isNotEmpty.
  late Friend _selected;
  final _titleController = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _selected = widget.friends.first;
  }

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    // Capture router and messenger while context is guaranteed valid.
    final messenger = ScaffoldMessenger.of(context);
    try {
      final session = await ref
          .read(studySessionListStateProvider.notifier)
          .createSession(
            _selected.id,
            title: _titleController.text.trim().isEmpty
                ? null
                : _titleController.text.trim(),
          );
      if (!mounted) return;
      // Capture router after the mounted check so the context is live.
      final router = GoRouter.of(context);
      Navigator.pop(context);
      router.push(AppRoute.sessionDetail(session.id));
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      messenger.showSnackBar(SnackBar(content: Text(_sessionErrorMessage(e))));
    }
  }

  String _sessionErrorMessage(Exception e) {
    final strings = ref.read(tProvider);
    final msg = e.toString();
    if (msg.contains('SESSION_003') || msg.contains('ALREADY_EXISTS')) {
      return strings.sessionAlreadyExists;
    }
    return strings.sessionCreateFailed;
  }

  @override
  Widget build(BuildContext context) {
    final strings = ref.watch(tProvider);
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              strings.newStudySession,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<Friend>(
              initialValue: _selected,
              decoration: InputDecoration(
                labelText: strings.studyPartner,
                border: const OutlineInputBorder(),
              ),
              items: widget.friends
                  .map(
                    (f) => DropdownMenuItem(
                      value: f,
                      child: Text('${f.username} (${f.nativeLanguage})'),
                    ),
                  )
                  .toList(),
              onChanged: _submitting
                  ? null
                  : (f) {
                      if (f != null) _selected = f;
                    },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _titleController,
              enabled: !_submitting,
              decoration: InputDecoration(
                labelText: strings.optionalSessionName,
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(strings.start),
              ),
            ),
          ],
        ),
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
                user.username.isNotEmpty ? user.username[0].toUpperCase() : '?',
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
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    user.nativeLanguage,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.person_add_rounded,
              size: 20,
              color: theme.colorScheme.primary,
            ),
          ],
        ),
      ),
    );
  }
}
