import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/domain/model/study_card.dart';
import 'package:tonebridge/features/study_session/presentation/speed_dial_fab.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';
import 'package:tonebridge/features/study_session/presentation/voice_card_sheet.dart';

// ── Sort enum ─────────────────────────────────────────────────────────────────

enum _CardSort { manual, newest, oldest, alphabetical, byStatus }

extension _CardSortLabel on _CardSort {
  String get label => switch (this) {
    _CardSort.manual => '내 순서',
    _CardSort.newest => '최신순',
    _CardSort.oldest => '오래된순',
    _CardSort.alphabetical => '가나다순',
    _CardSort.byStatus => '상태순',
  };
}

// ── Session Detail Page ───────────────────────────────────────────────────────

enum _SessionMenu { renameSession, deleteSession }

class SessionDetailPage extends ConsumerStatefulWidget {
  const SessionDetailPage({super.key, required this.sessionId});
  final String sessionId;

  @override
  ConsumerState<SessionDetailPage> createState() => _SessionDetailPageState();
}

class _SessionDetailPageState extends ConsumerState<SessionDetailPage> {
  bool _fabExpanded = false;
  bool _isSearchActive = false;
  String _searchQuery = '';
  _CardSort _sortOrder = _CardSort.manual;
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _toggleFab() => setState(() => _fabExpanded = !_fabExpanded);
  void _closeFab() => setState(() => _fabExpanded = false);

  void _activateSearch() => setState(() {
    _isSearchActive = true;
    _fabExpanded = false;
  });

  void _deactivateSearch() {
    _searchController.clear();
    setState(() {
      _isSearchActive = false;
      _searchQuery = '';
    });
  }

  void _goBack() {
    if (_isSearchActive) {
      _deactivateSearch();
      return;
    }
    context.go(AppRoute.study);
  }

  List<StudyCard> _applyFilter(List<StudyCard> cards) {
    var result = cards;

    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      result = result
          .where(
            (c) =>
                c.phrase.toLowerCase().contains(q) ||
                (c.context?.toLowerCase().contains(q) ?? false),
          )
          .toList();
    }

    result = switch (_sortOrder) {
      _CardSort.manual => [
        ...result,
      ]..sort((a, b) => a.position.compareTo(b.position)),
      _CardSort.newest => [
        ...result,
      ]..sort((a, b) => b.createdAt.compareTo(a.createdAt)),
      _CardSort.oldest => [
        ...result,
      ]..sort((a, b) => a.createdAt.compareTo(b.createdAt)),
      _CardSort.alphabetical => [
        ...result,
      ]..sort((a, b) => a.phrase.compareTo(b.phrase)),
      _CardSort.byStatus => [
        ...result,
      ]..sort((a, b) => a.cardStatus.index.compareTo(b.cardStatus.index)),
    };

    return result;
  }

  PreferredSizeWidget _buildAppBar() {
    final currentUserId = ref.watch(authStateProvider).value?.user.id;
    final session = ref
        .watch(studySessionProvider(widget.sessionId))
        .asData
        ?.value;
    final canManageSession =
        currentUserId != null && currentUserId == session?.createdBy;

    if (_isSearchActive) {
      return AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: _goBack,
        ),
        title: TextField(
          controller: _searchController,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: '표현 검색...',
            border: InputBorder.none,
          ),
          onChanged: (v) => setState(() => _searchQuery = v.trim()),
        ),
        actions: [
          if (_searchQuery.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.clear),
              onPressed: () {
                _searchController.clear();
                setState(() => _searchQuery = '');
              },
            ),
        ],
      );
    }

    return AppBar(
      leading: BackButton(onPressed: _goBack),
      title: const Text('카드 목록'),
      actions: [
        IconButton(
          icon: const Icon(Icons.search_rounded),
          onPressed: _activateSearch,
        ),
        PopupMenuButton<_CardSort>(
          icon: const Icon(Icons.sort_rounded),
          tooltip: '정렬',
          initialValue: _sortOrder,
          onSelected: (s) => setState(() => _sortOrder = s),
          itemBuilder: (_) => _CardSort.values
              .map(
                (s) => PopupMenuItem(
                  value: s,
                  child: Row(
                    children: [
                      if (s == _sortOrder)
                        const Icon(Icons.check_rounded, size: 18)
                      else
                        const SizedBox(width: 18),
                      const SizedBox(width: 8),
                      Text(s.label),
                    ],
                  ),
                ),
              )
              .toList(),
        ),
        IconButton(
          icon: const Icon(Icons.refresh),
          onPressed: () =>
              ref.invalidate(sessionCardsProvider(widget.sessionId)),
        ),
        if (canManageSession)
          PopupMenuButton<_SessionMenu>(
            onSelected: (item) {
              if (item == _SessionMenu.renameSession) {
                _showRenameSessionSheet(context);
              } else if (item == _SessionMenu.deleteSession) {
                _confirmDeleteSession(context);
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: _SessionMenu.renameSession,
                child: Row(
                  children: [
                    Icon(Icons.edit_outlined),
                    SizedBox(width: 8),
                    Text('세션 이름 수정'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: _SessionMenu.deleteSession,
                child: Row(
                  children: [
                    Icon(Icons.delete_outline),
                    SizedBox(width: 8),
                    Text('세션 삭제'),
                  ],
                ),
              ),
            ],
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final cardsAsync = ref.watch(sessionCardsProvider(widget.sessionId));

    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _goBack();
      },
      child: GestureDetector(
        onTap: _fabExpanded ? _closeFab : null,
        child: Scaffold(
          appBar: _buildAppBar(),
          body: cardsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('오류: $e')),
            data: (allCards) {
              final cards = _applyFilter(allCards);
              final noAudio = allCards
                  .where((c) => c.cardStatus == CardStatus.noAudio)
                  .length;
              final recorded = allCards
                  .where((c) => c.cardStatus == CardStatus.recorded)
                  .length;
              final corrected = allCards
                  .where((c) => c.cardStatus == CardStatus.corrected)
                  .length;
              final canReorder =
                  !_isSearchActive && _sortOrder == _CardSort.manual;

              return CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: _ProgressHeader(
                      total: allCards.length,
                      corrected: corrected,
                      recorded: recorded,
                      noAudio: noAudio,
                    ),
                  ),
                  if (_isSearchActive && _searchQuery.isNotEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                        child: Text(
                          '검색 결과 ${cards.length}개',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.outline,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                  if (allCards.isEmpty)
                    const SliverFillRemaining(
                      child: Center(
                        child: Text(
                          '아직 카드가 없어요.\n아래 버튼으로 첫 카드를 추가해보세요!',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey),
                        ),
                      ),
                    )
                  else if (cards.isEmpty)
                    const SliverFillRemaining(
                      child: Center(
                        child: Text(
                          '검색 결과가 없어요.',
                          style: TextStyle(color: Colors.grey),
                        ),
                      ),
                    )
                  else if (canReorder)
                    SliverToBoxAdapter(
                      child: ReorderableListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                        itemCount: cards.length,
                        onReorder: (oldIndex, newIndex) =>
                            _moveWithinSession(cards, oldIndex, newIndex),
                        itemBuilder: (_, i) => _CardListItem(
                          key: ValueKey(cards[i].id),
                          card: cards[i],
                          sessionId: widget.sessionId,
                          showDragHandle: true,
                        ),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                      sliver: SliverList.builder(
                        itemCount: cards.length,
                        itemBuilder: (_, i) => _CardListItem(
                          key: ValueKey(cards[i].id),
                          card: cards[i],
                          sessionId: widget.sessionId,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          floatingActionButton: SpeedDialFab(
            expanded: _fabExpanded,
            onToggle: _toggleFab,
            onTextCard: () {
              _closeFab();
              _showAddCardSheet(context);
            },
            onVoiceCard: () {
              _closeFab();
              _showVoiceCardSheet(context);
            },
          ),
        ),
      ),
    );
  }

  Future<void> _moveWithinSession(
    List<StudyCard> cards,
    int oldIndex,
    int newIndex,
  ) async {
    if (oldIndex < newIndex) newIndex -= 1;
    if (oldIndex == newIndex) return;
    final card = cards[oldIndex];
    try {
      await ref
          .read(studySessionRepositoryProvider)
          .moveCard(
            cardId: card.id,
            targetSessionId: widget.sessionId,
            position: newIndex,
          );
      ref.invalidate(sessionCardsProvider(widget.sessionId));
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('카드 이동 실패: $e')));
    }
  }

  Future<void> _confirmDeleteSession(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('세션 삭제'),
        content: const Text('이 세션과 카드 목록에서 숨겨집니다.\n삭제하시겠어요?'),
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
      await ref
          .read(studySessionListStateProvider.notifier)
          .deleteSession(widget.sessionId);
      if (!context.mounted) return;
      messenger.showSnackBar(const SnackBar(content: Text('세션이 삭제되었습니다')));
      context.pop();
    } on Exception catch (e) {
      if (!context.mounted) return;
      messenger.showSnackBar(SnackBar(content: Text('삭제 실패: $e')));
    }
  }

  void _showRenameSessionSheet(BuildContext context) {
    final controller = TextEditingController();
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
            const Text(
              '세션 이름 수정',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: '세션 이름',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () async {
                  final title = controller.text.trim();
                  final navigator = Navigator.of(context);
                  final messenger = ScaffoldMessenger.of(context);
                  try {
                    await ref
                        .read(studySessionListStateProvider.notifier)
                        .updateSession(
                          widget.sessionId,
                          title: title.isEmpty ? null : title,
                        );
                    ref.invalidate(studySessionProvider(widget.sessionId));
                    if (!mounted) return;
                    navigator.pop();
                    messenger.showSnackBar(
                      const SnackBar(content: Text('세션 이름을 수정했어요')),
                    );
                  } on Exception catch (e) {
                    messenger.showSnackBar(
                      SnackBar(content: Text('수정 실패: $e')),
                    );
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

  void _showAddCardSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AddCardSheet(sessionId: widget.sessionId),
    );
  }

  void _showVoiceCardSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      isDismissible: false,
      builder: (_) => VoiceCardSheet(sessionId: widget.sessionId),
    );
  }
}

// ── Progress Header ───────────────────────────────────────────────────────────

class _ProgressHeader extends StatelessWidget {
  const _ProgressHeader({
    required this.total,
    required this.corrected,
    required this.recorded,
    required this.noAudio,
  });

  final int total, corrected, recorded, noAudio;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progress = total == 0 ? 0.0 : corrected / total;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '진행도',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: theme.colorScheme.onPrimaryContainer,
                ),
              ),
              Text(
                '$corrected / $total',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: theme.colorScheme.onPrimaryContainer,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 10,
              backgroundColor: theme.colorScheme.onPrimaryContainer.withOpacity(
                0.15,
              ),
              color: theme.colorScheme.primary,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _StatusChip(label: '교정완료', count: corrected, color: Colors.green),
              const SizedBox(width: 8),
              _StatusChip(label: '녹음완료', count: recorded, color: Colors.orange),
              const SizedBox(width: 8),
              _StatusChip(label: '미녹음', count: noAudio, color: Colors.grey),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.count,
    required this.color,
  });
  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            '$label $count',
            style: TextStyle(
              fontSize: 12,
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Card List Item ────────────────────────────────────────────────────────────

enum _CardItemAction { move }

class _CardListItem extends ConsumerWidget {
  const _CardListItem({
    super.key,
    required this.card,
    required this.sessionId,
    this.showDragHandle = false,
  });
  final StudyCard card;
  final String sessionId;
  final bool showDragHandle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final currentUserId = ref.watch(authStateProvider).value?.user.id;
    final canManage = currentUserId == card.createdByUserId;

    final (statusIcon, statusColor, statusLabel) = switch (card.cardStatus) {
      CardStatus.corrected => (
        Icons.check_circle_rounded,
        Colors.green,
        '교정완료',
      ),
      CardStatus.recorded => (Icons.mic_rounded, Colors.orange, '녹음완료'),
      CardStatus.noAudio => (
        Icons.radio_button_unchecked_rounded,
        Colors.grey,
        '미녹음',
      ),
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Icon(statusIcon, color: statusColor, size: 28),
        title: Text(
          card.phrase,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        ),
        subtitle: card.context != null
            ? Text(
                card.context!,
                style: TextStyle(
                  color: theme.colorScheme.outline,
                  fontSize: 13,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              )
            : null,
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    statusLabel,
                    style: TextStyle(
                      fontSize: 11,
                      color: statusColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (canManage)
                  PopupMenuButton<_CardItemAction>(
                    tooltip: '카드 메뉴',
                    padding: EdgeInsets.zero,
                    icon: const Icon(Icons.more_vert_rounded, size: 20),
                    onSelected: (action) {
                      if (action == _CardItemAction.move) {
                        _showMoveCardSheet(context, ref);
                      }
                    },
                    itemBuilder: (_) => const [
                      PopupMenuItem(
                        value: _CardItemAction.move,
                        child: Row(
                          children: [
                            Icon(Icons.open_with_rounded),
                            SizedBox(width: 8),
                            Text('다른 세션으로 이동'),
                          ],
                        ),
                      ),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Icon(
              showDragHandle
                  ? Icons.drag_indicator_rounded
                  : Icons.chevron_right_rounded,
              color: theme.colorScheme.outline,
            ),
          ],
        ),
        onTap: () =>
            context.push(AppRoute.cardDetail(sessionId, card.id), extra: card),
      ),
    );
  }

  void _showMoveCardSheet(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.read(studySessionListStateProvider);
    final strings = ref.read(tProvider);
    showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      builder: (_) => sessionsAsync.when(
        loading: () => const SizedBox(
          height: 180,
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (e, __) => SizedBox(
          height: 180,
          child: Center(child: Text('세션을 불러오지 못했어요: $e')),
        ),
        data: (sessions) {
          final targets = sessions.where((s) => s.id != sessionId).toList();
          return Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '카드 이동',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                if (targets.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Center(child: Text('이동할 수 있는 다른 세션이 없어요.')),
                  )
                else
                  ...targets.map(
                    (session) => ListTile(
                      title: Text(session.title ?? strings.defaultSessionTitle),
                      subtitle: Text(
                        strings.participantCount(session.memberIds.length),
                      ),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () async {
                        final navigator = Navigator.of(context);
                        final messenger = ScaffoldMessenger.of(context);
                        try {
                          await ref
                              .read(studySessionRepositoryProvider)
                              .moveCard(
                                cardId: card.id,
                                targetSessionId: session.id,
                                position: 0,
                              );
                          ref.invalidate(sessionCardsProvider(sessionId));
                          ref.invalidate(sessionCardsProvider(session.id));
                          navigator.pop();
                          messenger.showSnackBar(
                            const SnackBar(content: Text('카드를 이동했어요')),
                          );
                        } on Exception catch (e) {
                          messenger.showSnackBar(
                            SnackBar(content: Text('카드 이동 실패: $e')),
                          );
                        }
                      },
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Text Add Card Sheet ───────────────────────────────────────────────────────

class _AddCardSheet extends ConsumerStatefulWidget {
  const _AddCardSheet({required this.sessionId});
  final String sessionId;

  @override
  ConsumerState<_AddCardSheet> createState() => _AddCardSheetState();
}

class _AddCardSheetState extends ConsumerState<_AddCardSheet> {
  final _phraseController = TextEditingController();
  final _contextController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _phraseController.dispose();
    _contextController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final phrase = _phraseController.text.trim();
    if (phrase.isEmpty || _submitting) return;
    setState(() => _submitting = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(studySessionRepositoryProvider)
          .createCard(
            sessionId: widget.sessionId,
            phrase: phrase,
            context: _contextController.text.trim().isEmpty
                ? null
                : _contextController.text.trim(),
          );
      if (!mounted) return;
      ref.invalidate(sessionCardsProvider(widget.sessionId));
      Navigator.pop(context);
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
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
            const Text(
              '새 카드 추가',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _phraseController,
              autofocus: true,
              enabled: !_submitting,
              decoration: const InputDecoration(
                labelText: '표현 입력 (필수)',
                hintText: '예: 밥 먹었어?',
                border: OutlineInputBorder(),
              ),
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _contextController,
              enabled: !_submitting,
              decoration: const InputDecoration(
                labelText: '상황 설명 (선택)',
                hintText: '예: 친구에게 안부 물을 때 쓰는 표현',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
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
                    : const Text('추가하기'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
