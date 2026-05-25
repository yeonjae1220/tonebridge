import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/core/services/audio_recorder_service.dart';
import 'package:tonebridge/core/services/presigned_upload_service.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/domain/model/study_card.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';
import 'package:permission_handler/permission_handler.dart';

// ── Helpers ───────────────────────────────────────────────────────────────────

void _showMicPermissionError(BuildContext context, RecorderPermissionException e) {
  if (e.isPermanentlyDenied) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('마이크 권한 필요'),
        content: const Text('앱 설정에서 마이크 권한을 허용해야 녹음할 수 있어요.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              openAppSettings();
            },
            child: const Text('설정으로 이동'),
          ),
        ],
      ),
    );
  } else {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('마이크 권한이 필요해요')),
    );
  }
}

// ── Sort enum ─────────────────────────────────────────────────────────────────

enum _CardSort { newest, oldest, alphabetical, byStatus }

extension _CardSortLabel on _CardSort {
  String get label => switch (this) {
        _CardSort.newest => '최신순',
        _CardSort.oldest => '오래된순',
        _CardSort.alphabetical => '가나다순',
        _CardSort.byStatus => '상태순',
      };
}

// ── Session Detail Page ───────────────────────────────────────────────────────

enum _SessionMenu { endSession }

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
  _CardSort _sortOrder = _CardSort.newest;
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

  List<StudyCard> _applyFilter(List<StudyCard> cards) {
    var result = cards;

    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      result = result
          .where((c) =>
              c.phrase.toLowerCase().contains(q) ||
              (c.context?.toLowerCase().contains(q) ?? false))
          .toList();
    }

    result = switch (_sortOrder) {
      _CardSort.newest => [...result]
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt)),
      _CardSort.oldest => [...result]
        ..sort((a, b) => a.createdAt.compareTo(b.createdAt)),
      _CardSort.alphabetical => [...result]
        ..sort((a, b) => a.phrase.compareTo(b.phrase)),
      _CardSort.byStatus => [...result]
        ..sort((a, b) => a.cardStatus.index.compareTo(b.cardStatus.index)),
    };

    return result;
  }

  PreferredSizeWidget _buildAppBar() {
    if (_isSearchActive) {
      return AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: _deactivateSearch,
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
              .map((s) => PopupMenuItem(
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
                  ))
              .toList(),
        ),
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
    );
  }

  @override
  Widget build(BuildContext context) {
    final cardsAsync = ref.watch(sessionCardsProvider(widget.sessionId));

    return GestureDetector(
      onTap: _fabExpanded ? _closeFab : null,
      child: Scaffold(
        appBar: _buildAppBar(),
        body: cardsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('오류: $e')),
          data: (allCards) {
            final cards = _applyFilter(allCards);
            final noAudio =
                allCards.where((c) => c.cardStatus == CardStatus.noAudio).length;
            final recorded =
                allCards.where((c) => c.cardStatus == CardStatus.recorded).length;
            final corrected =
                allCards.where((c) => c.cardStatus == CardStatus.corrected).length;

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
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
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
        floatingActionButton: _SpeedDialFab(
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
      builder: (_) => _VoiceCardSheet(sessionId: widget.sessionId),
    );
  }
}

// ── Speed Dial FAB ────────────────────────────────────────────────────────────

class _SpeedDialFab extends StatelessWidget {
  const _SpeedDialFab({
    required this.expanded,
    required this.onToggle,
    required this.onTextCard,
    required this.onVoiceCard,
  });

  final bool expanded;
  final VoidCallback onToggle;
  final VoidCallback onTextCard;
  final VoidCallback onVoiceCard;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        AnimatedOpacity(
          opacity: expanded ? 1.0 : 0.0,
          duration: const Duration(milliseconds: 180),
          child: AnimatedSlide(
            offset: expanded ? Offset.zero : const Offset(0, 0.25),
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            child: IgnorePointer(
              ignoring: !expanded,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  _MiniFab(
                    icon: Icons.mic_rounded,
                    label: '음성',
                    onTap: onVoiceCard,
                  ),
                  const SizedBox(height: 10),
                  _MiniFab(
                    icon: Icons.text_fields_rounded,
                    label: '텍스트',
                    onTap: onTextCard,
                  ),
                  const SizedBox(height: 14),
                ],
              ),
            ),
          ),
        ),
        FloatingActionButton(
          onPressed: onToggle,
          tooltip: '카드 추가',
          child: AnimatedRotation(
            turns: expanded ? 0.125 : 0,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeInOut,
            child: const Icon(Icons.add_rounded),
          ),
        ),
      ],
    );
  }
}

class _MiniFab extends StatelessWidget {
  const _MiniFab({
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
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Card(
          elevation: 2,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Text(label,
                style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: theme.colorScheme.onSurface)),
          ),
        ),
        const SizedBox(width: 8),
        FloatingActionButton.small(
          heroTag: label,
          onPressed: onTap,
          child: Icon(icon),
        ),
      ],
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

// ── Card List Item ────────────────────────────────────────────────────────────

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
      await ref.read(studySessionRepositoryProvider).createCard(
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

// ── Voice Card Sheet ──────────────────────────────────────────────────────────

class _VoiceCardSheet extends ConsumerStatefulWidget {
  const _VoiceCardSheet({required this.sessionId});
  final String sessionId;

  @override
  ConsumerState<_VoiceCardSheet> createState() => _VoiceCardSheetState();
}

class _VoiceCardSheetState extends ConsumerState<_VoiceCardSheet> {
  late final AudioRecorderService _recorder;
  final _phraseController = TextEditingController();
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _recorder = AudioRecorderService();
    _recorder.addListener(_onRecorderChange);
    WidgetsBinding.instance.addPostFrameCallback((_) => _startRecording());
  }

  void _onRecorderChange() => setState(() {});

  @override
  void dispose() {
    _recorder.removeListener(_onRecorderChange);
    if (_recorder.state == RecorderState.recording) {
      unawaited(_recorder.stop());
    }
    _recorder.dispose();
    _phraseController.dispose();
    super.dispose();
  }

  Future<void> _startRecording() async {
    try {
      await _recorder.start();
    } on RecorderPermissionException catch (e) {
      if (mounted) {
        _showMicPermissionError(context, e);
        Navigator.of(context).pop();
      }
    }
  }

  Future<void> _createCard() async {
    if (_recorder.file == null) return;
    setState(() => _uploading = true);

    final now = DateTime.now();
    final phrase = _phraseController.text.trim().isEmpty
        ? '음성 카드 ${now.month}/${now.day} ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}'
        : _phraseController.text.trim();

    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);

    try {
      final repo = ref.read(studySessionRepositoryProvider);

      final card = await repo.createCard(
        sessionId: widget.sessionId,
        phrase: phrase,
      );

      final fileName = 'native_${DateTime.now().millisecondsSinceEpoch}.aac';
      final urls = await repo.getNativeAudioUploadUrl(card.id, fileName);

      final uploader = PresignedUploadService(dio: ref.read(dioProvider));
      await uploader.uploadToUrl(
        file: _recorder.file!,
        uploadUrl: urls['uploadUrl']!,
      );

      await repo.confirmNativeAudio(card.id, urls['audioKey']!);
      ref.invalidate(sessionCardsProvider(widget.sessionId));

      if (!mounted) return;
      Navigator.of(context).pop();
      router.push(AppRoute.cardDetail(widget.sessionId, card.id));
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() => _uploading = false);
      // If the card was already created but audio upload failed, the card
      // still exists without audio. The session list will refresh and the
      // user can add audio from the card detail page.
      messenger.showSnackBar(
        SnackBar(
          content: Text('음성 업로드에 실패했어요. 카드는 생성됐으니 카드 상세에서 다시 녹음할 수 있어요. ($e)'),
          backgroundColor: Theme.of(context).colorScheme.error,
          duration: const Duration(seconds: 6),
        ),
      );
      ref.invalidate(sessionCardsProvider(widget.sessionId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isRecording = _recorder.state == RecorderState.recording;
    final hasStopped = _recorder.state == RecorderState.stopped;

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
          Row(
            children: [
              const Text(
                '음성 카드 추가',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              ),
              const Spacer(),
              if (!_uploading)
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(context).pop(),
                ),
            ],
          ),
          const SizedBox(height: 24),
          Center(
            child: Column(
              children: [
                if (!isRecording && !hasStopped) ...[
                  const CircularProgressIndicator(),
                  const SizedBox(height: 12),
                  const Text('녹음 준비 중...'),
                ] else if (isRecording) ...[
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.error.withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.mic_rounded,
                      size: 36,
                      color: theme.colorScheme.error,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _recorder.formattedDuration,
                    style: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.w700,
                      color: theme.colorScheme.error,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '녹음 중...',
                    style: TextStyle(color: theme.colorScheme.outline),
                  ),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: _recorder.stop,
                    icon: const Icon(Icons.stop_rounded),
                    label: const Text('녹음 중지'),
                    style: FilledButton.styleFrom(
                      backgroundColor: theme.colorScheme.error,
                    ),
                  ),
                ] else ...[
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      size: 36,
                      color: Colors.green,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '${_recorder.formattedDuration} 녹음 완료',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: () {
                      _recorder.reset();
                      _startRecording();
                    },
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('다시 녹음'),
                  ),
                ],
              ],
            ),
          ),
          if (hasStopped) ...[
            const SizedBox(height: 20),
            TextField(
              controller: _phraseController,
              enabled: !_uploading,
              decoration: const InputDecoration(
                labelText: '표현 입력 (선택)',
                hintText: '예: 밥 먹었어? (비워두면 자동 생성)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _uploading ? null : _createCard,
                child: _uploading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('카드 생성'),
              ),
            ),
          ],
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
