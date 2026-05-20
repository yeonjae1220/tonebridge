import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/features/study_session/domain/model/study_card.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';

enum _SessionMenu { endSession }

class SessionDetailPage extends ConsumerStatefulWidget {
  const SessionDetailPage({super.key, required this.sessionId});
  final String sessionId;

  @override
  ConsumerState<SessionDetailPage> createState() => _SessionDetailPageState();
}

class _SessionDetailPageState extends ConsumerState<SessionDetailPage> {
  @override
  Widget build(BuildContext context) {
    final cardsAsync = ref.watch(sessionCardsProvider(widget.sessionId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('카드 목록'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                ref.invalidate(sessionCardsProvider(widget.sessionId)),
          ),
          PopupMenuButton<_SessionMenu>(
            onSelected: (item) {
              if (item == _SessionMenu.endSession) {
                _confirmEndSession(context);
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: _SessionMenu.endSession,
                child: Row(
                  children: [
                    Icon(Icons.stop_circle_outlined),
                    SizedBox(width: 8),
                    Text('세션 종료'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: cardsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('오류: $e')),
        data: (cards) {
          final noAudio =
              cards.where((c) => c.cardStatus == CardStatus.noAudio).length;
          final recorded =
              cards.where((c) => c.cardStatus == CardStatus.recorded).length;
          final corrected =
              cards.where((c) => c.cardStatus == CardStatus.corrected).length;

          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: _ProgressHeader(
                  total: cards.length,
                  corrected: corrected,
                  recorded: recorded,
                  noAudio: noAudio,
                ),
              ),
              if (cards.isEmpty)
                const SliverFillRemaining(
                  child: Center(
                    child: Text(
                      '아직 카드가 없어요.\n아래 버튼으로 첫 카드를 추가해보세요!',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                  sliver: SliverList.builder(
                    itemCount: cards.length,
                    itemBuilder: (_, i) => _CardListItem(
                      card: cards[i],
                      sessionId: widget.sessionId,
                    ),
                  ),
                ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddCardSheet(context),
        icon: const Icon(Icons.add),
        label: const Text('카드 추가'),
      ),
    );
  }

  Future<void> _confirmEndSession(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('세션 종료'),
        content: const Text('세션을 종료하면 더 이상 카드를 추가하거나 수정할 수 없습니다.\n종료하시겠어요?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('종료'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(studySessionListStateProvider.notifier)
          .endSession(widget.sessionId);
      if (!context.mounted) return;
      messenger.showSnackBar(
        const SnackBar(content: Text('세션이 종료되었습니다')),
      );
      context.pop();
    } on Exception catch (e) {
      if (!context.mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text('오류: $e')),
      );
    }
  }

  void _showAddCardSheet(BuildContext context) {
    final phraseController = TextEditingController();
    final contextController = TextEditingController();
    final messenger = ScaffoldMessenger.of(context);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => Padding(
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
            const Text('새 카드 추가',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            TextField(
              controller: phraseController,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: '표현 입력 (필수)',
                hintText: '예: 밥 먹었어?',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: contextController,
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
                onPressed: () async {
                  final phrase = phraseController.text.trim();
                  if (phrase.isEmpty) return;
                  final contextText = contextController.text.trim();
                  try {
                    await ref.read(studySessionRepositoryProvider).createCard(
                          sessionId: widget.sessionId,
                          phrase: phrase,
                          context: contextText.isEmpty ? null : contextText,
                        );
                    ref.invalidate(sessionCardsProvider(widget.sessionId));
                    if (ctx.mounted) Navigator.pop(ctx);
                  } catch (e) {
                    messenger.showSnackBar(
                      SnackBar(content: Text(e.toString())),
                    );
                  }
                },
                child: const Text('추가하기'),
              ),
            ),
          ],
        ),
      ),
    ).whenComplete(() {
      phraseController.dispose();
      contextController.dispose();
    });
  }
}

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
              Text('진행도',
                  style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: theme.colorScheme.onPrimaryContainer)),
              Text('$corrected / $total',
                  style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: theme.colorScheme.onPrimaryContainer)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 10,
              backgroundColor:
                  theme.colorScheme.onPrimaryContainer.withOpacity(0.15),
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
  const _StatusChip(
      {required this.label, required this.count, required this.color});
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
          Text('$label $count',
              style: TextStyle(
                  fontSize: 12, color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _CardListItem extends StatelessWidget {
  const _CardListItem({required this.card, required this.sessionId});
  final StudyCard card;
  final String sessionId;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final (statusIcon, statusColor, statusLabel) = switch (card.cardStatus) {
      CardStatus.corrected => (
          Icons.check_circle_rounded,
          Colors.green,
          '교정완료'
        ),
      CardStatus.recorded => (Icons.mic_rounded, Colors.orange, '녹음완료'),
      CardStatus.noAudio => (
          Icons.radio_button_unchecked_rounded,
          Colors.grey,
          '미녹음'
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
                style:
                    TextStyle(color: theme.colorScheme.outline, fontSize: 13),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              )
            : null,
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(statusLabel,
                  style: TextStyle(
                      fontSize: 11,
                      color: statusColor,
                      fontWeight: FontWeight.w600)),
            ),
            const SizedBox(height: 4),
            Icon(Icons.chevron_right_rounded, color: theme.colorScheme.outline),
          ],
        ),
        onTap: () => context.push(
          AppRoute.cardDetail(sessionId, card.id),
          extra: card,
        ),
      ),
    );
  }
}
