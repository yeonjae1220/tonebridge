import 'dart:math' show pi;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:tonebridge/core/services/audio_recorder_service.dart';
import 'package:tonebridge/core/services/presigned_upload_service.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/domain/model/learner_attempt.dart';
import 'package:tonebridge/features/study_session/domain/model/study_card.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';

class CardDetailPage extends ConsumerStatefulWidget {
  const CardDetailPage({
    super.key,
    required this.cardId,
    required this.sessionId,
    this.initialCard,
  });

  final String cardId;
  final String sessionId;
  final StudyCard? initialCard;

  @override
  ConsumerState<CardDetailPage> createState() => _CardDetailPageState();
}

class _CardDetailPageState extends ConsumerState<CardDetailPage>
    with SingleTickerProviderStateMixin {
  late final AudioRecorderService _recorder;
  late final AnimationController _flipController;
  late final Animation<double> _flipAnimation;

  AudioPlayer? _nativePlayer;
  AudioPlayer? _attemptPlayer;
  bool _isFlipped = false;
  bool _uploading = false;
  // After a successful native-audio upload, switch from the stale initialCard
  // to the live provider so the card reflects the updated nativeAudioUrl.
  bool _usedInitialCard = true;

  @override
  void initState() {
    super.initState();
    _recorder = AudioRecorderService();
    _recorder.addListener(_onRecorderChange);

    _flipController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _flipAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _flipController, curve: Curves.easeInOut),
    );
  }

  void _onRecorderChange() => setState(() {});

  @override
  void dispose() {
    _recorder.removeListener(_onRecorderChange);
    _recorder.dispose();
    _nativePlayer?.dispose();
    _attemptPlayer?.dispose();
    _flipController.dispose();
    super.dispose();
  }

  void _flip() {
    setState(() => _isFlipped = !_isFlipped);
    if (_isFlipped) {
      _flipController.forward();
    } else {
      _flipController.reverse();
    }
  }

  Future<void> _playNativeAudio(StudyCard card) async {
    if (card.nativeAudioUrl == null) return;
    _nativePlayer ??= AudioPlayer();
    try {
      final repo = ref.read(studySessionRepositoryProvider);
      final downloadUrl = await repo.getNativeAudioDownloadUrl(card.id);
      await _nativePlayer!.setUrl(downloadUrl);
      await _nativePlayer!.play();
    } catch (_) {}
  }

  Future<void> _submitAttempt() async {
    if (_recorder.file == null) return;
    setState(() => _uploading = true);
    try {
      final uploader = PresignedUploadService(dio: ref.read(dioProvider));
      final key = await uploader.upload(
        file: _recorder.file!,
        fileName: 'attempt_${DateTime.now().millisecondsSinceEpoch}.aac',
      );

      await ref
          .read(cardAttemptStateProvider.notifier)
          .submit(widget.cardId, key);

      ref.invalidate(cardAttemptsProvider(widget.cardId));
      ref.invalidate(sessionCardsProvider(widget.sessionId));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('발음 녹음을 제출했어요!')),
        );
        _recorder.reset();
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_errorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _submitNativeAudio(StudyCard card) async {
    if (_recorder.file == null) return;
    setState(() => _uploading = true);
    try {
      final repo = ref.read(studySessionRepositoryProvider);
      final fileName = 'native_${DateTime.now().millisecondsSinceEpoch}.aac';
      final urls = await repo.getNativeAudioUploadUrl(card.id, fileName);
      final uploader = PresignedUploadService(dio: ref.read(dioProvider));
      await uploader.uploadToUrl(
        file: _recorder.file!,
        uploadUrl: urls['uploadUrl']!,
      );
      await repo.confirmNativeAudio(card.id, urls['audioKey']!);

      ref.invalidate(cardDetailProvider(widget.cardId));
      ref.invalidate(sessionCardsProvider(widget.sessionId));

      if (mounted) {
        setState(() => _usedInitialCard = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('원어민 발음을 등록했어요!')),
        );
        _recorder.reset();
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_errorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  String _errorMessage(Exception e) {
    final msg = e.toString();
    if (msg.contains('CARD_004')) return '자신이 만든 카드에는 발음을 제출할 수 없어요.';
    if (msg.contains('SESSION_002')) return '세션 멤버만 이용할 수 있어요.';
    if (msg.contains('401') || msg.contains('403')) return '권한이 없어요.';
    return '오류가 발생했어요. 다시 시도해 주세요.';
  }

  @override
  Widget build(BuildContext context) {
    final cardAsync = (_usedInitialCard && widget.initialCard != null)
        ? AsyncValue.data(widget.initialCard!)
        : ref.watch(cardDetailProvider(widget.cardId));
    final attemptsAsync = ref.watch(cardAttemptsProvider(widget.cardId));
    final currentUserId = ref.watch(authStateProvider).value?.user.id;

    return Scaffold(
      appBar: AppBar(title: const Text('카드 학습')),
      body: cardAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('카드를 불러올 수 없어요: ${_errorMessage(e is Exception ? e : Exception(e))}')),
        data: (card) {
          final isCardCreator = currentUserId == card.createdByUserId;
          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _FlashCard(
                    card: card,
                    isFlipped: _isFlipped,
                    flipAnimation: _flipAnimation,
                    onFlip: _flip,
                    onPlayNative: () => _playNativeAudio(card),
                  ),
                  const SizedBox(height: 24),
                  if (isCardCreator && card.nativeAudioUrl == null) ...[
                    _NativeAudioUploadSection(
                      recorder: _recorder,
                      uploading: _uploading,
                      onSubmit: () => _submitNativeAudio(card),
                    ),
                    const SizedBox(height: 24),
                  ] else if (!isCardCreator) ...[
                    _RecordingSection(
                      recorder: _recorder,
                      uploading: _uploading,
                      hasNativeAudio: card.nativeAudioUrl != null,
                      onSubmit: _submitAttempt,
                    ),
                    const SizedBox(height: 24),
                  ],
                  _AttemptsSection(
                    attemptsAsync: attemptsAsync,
                    cardId: widget.cardId,
                    currentUserId: currentUserId,
                    cardCreatorId: card.createdByUserId,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _FlashCard extends StatelessWidget {
  const _FlashCard({
    required this.card,
    required this.isFlipped,
    required this.flipAnimation,
    required this.onFlip,
    required this.onPlayNative,
  });

  final StudyCard card;
  final bool isFlipped;
  final Animation<double> flipAnimation;
  final VoidCallback onFlip;
  final VoidCallback onPlayNative;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onFlip,
      child: AnimatedBuilder(
        animation: flipAnimation,
        builder: (_, __) {
          final angle = flipAnimation.value * pi;
          final showBack = flipAnimation.value > 0.5;

          return Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateY(angle),
            child: Container(
              height: 220,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: showBack
                      ? [theme.colorScheme.secondaryContainer,
                          theme.colorScheme.secondary.withValues(alpha: 0.3)]
                      : [theme.colorScheme.primaryContainer,
                          theme.colorScheme.primary.withValues(alpha: 0.2)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Transform(
                alignment: Alignment.center,
                transform: showBack
                    ? (Matrix4.identity()..rotateY(pi))
                    : Matrix4.identity(),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: showBack
                      ? _CardBack(card: card, onPlayNative: onPlayNative)
                      : _CardFront(card: card),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _CardFront extends StatelessWidget {
  const _CardFront({required this.card});
  final StudyCard card;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          card.phrase,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: theme.colorScheme.onPrimaryContainer,
          ),
        ),
        if (card.context != null) ...[
          const SizedBox(height: 12),
          Text(
            card.context!,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: theme.colorScheme.onPrimaryContainer.withValues(alpha: 0.7),
            ),
          ),
        ],
        const SizedBox(height: 16),
        Text(
          '탭하여 뒤집기',
          style: TextStyle(
            fontSize: 12,
            color: theme.colorScheme.onPrimaryContainer.withValues(alpha: 0.5),
          ),
        ),
      ],
    );
  }
}

class _CardBack extends StatelessWidget {
  const _CardBack({required this.card, required this.onPlayNative});
  final StudyCard card;
  final VoidCallback onPlayNative;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (card.nativeAudioUrl != null)
          ElevatedButton.icon(
            onPressed: onPlayNative,
            icon: const Icon(Icons.volume_up_rounded),
            label: const Text('원어민 발음 듣기'),
            style: ElevatedButton.styleFrom(
              backgroundColor: theme.colorScheme.secondary,
              foregroundColor: theme.colorScheme.onSecondary,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          )
        else
          Text(
            '원어민 발음이 아직 없어요',
            style: TextStyle(color: theme.colorScheme.outline),
          ),
        if (card.explanation != null) ...[
          const SizedBox(height: 16),
          Text(
            card.explanation!,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: theme.colorScheme.onSecondaryContainer.withValues(alpha: 0.8),
            ),
          ),
        ],
        if (card.tags.isNotEmpty) ...[
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            children: card.tags
                .map((tag) => Chip(
                      label: Text(tag, style: const TextStyle(fontSize: 11)),
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ))
                .toList(),
          ),
        ],
      ],
    );
  }
}

class _RecordingSection extends StatelessWidget {
  const _RecordingSection({
    required this.recorder,
    required this.uploading,
    required this.hasNativeAudio,
    required this.onSubmit,
  });

  final AudioRecorderService recorder;
  final bool uploading;
  final bool hasNativeAudio;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.mic_rounded, color: theme.colorScheme.primary),
              const SizedBox(width: 8),
              const Text('내 발음 녹음',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (recorder.state == RecorderState.idle)
                FilledButton.icon(
                  onPressed: () async {
                    try {
                      await recorder.start();
                    } on RecorderPermissionException {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('마이크 권한이 필요해요')),
                        );
                      }
                    }
                  },
                  icon: const Icon(Icons.fiber_manual_record_rounded),
                  label: const Text('녹음 시작'),
                  style: FilledButton.styleFrom(backgroundColor: theme.colorScheme.error),
                )
              else if (recorder.state == RecorderState.recording)
                Column(
                  children: [
                    Text(
                      recorder.formattedDuration,
                      style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: theme.colorScheme.error),
                    ),
                    const SizedBox(height: 8),
                    FilledButton.icon(
                      onPressed: recorder.stop,
                      icon: const Icon(Icons.stop_rounded),
                      label: const Text('녹음 중지'),
                    ),
                  ],
                )
              else ...[
                IconButton.filled(
                  onPressed: recorder.reset,
                  icon: const Icon(Icons.refresh_rounded),
                  tooltip: '다시 녹음',
                ),
                const SizedBox(width: 12),
                if (uploading)
                  const CircularProgressIndicator()
                else
                  FilledButton.icon(
                    onPressed: onSubmit,
                    icon: const Icon(Icons.send_rounded),
                    label: const Text('제출'),
                  ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _AttemptsSection extends ConsumerWidget {
  const _AttemptsSection({
    required this.attemptsAsync,
    required this.cardId,
    required this.currentUserId,
    required this.cardCreatorId,
  });

  final AsyncValue<List<LearnerAttempt>> attemptsAsync;
  final String cardId;
  final String? currentUserId;
  final String cardCreatorId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Only the card creator (native speaker) can add correction notes
    final canAddNote = currentUserId == cardCreatorId;

    return attemptsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Text('시도 기록을 불러올 수 없어요.',
                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
            const Spacer(),
            TextButton.icon(
              onPressed: () => ref.invalidate(cardAttemptsProvider(cardId)),
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('재시도'),
            ),
          ],
        ),
      ),
      data: (attempts) {
        if (attempts.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('시도 기록',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            ...attempts.map((a) => _AttemptItem(
                  attempt: a,
                  cardId: cardId,
                  canAddNote: canAddNote,
                  onNoteAdded: () => ref.invalidate(cardAttemptsProvider(cardId)),
                )),
          ],
        );
      },
    );
  }
}

class _AttemptItem extends ConsumerStatefulWidget {
  const _AttemptItem({
    required this.attempt,
    required this.cardId,
    required this.canAddNote,
    required this.onNoteAdded,
  });

  final LearnerAttempt attempt;
  final String cardId;
  final bool canAddNote;
  final VoidCallback onNoteAdded;

  @override
  ConsumerState<_AttemptItem> createState() => _AttemptItemState();
}

class _AttemptItemState extends ConsumerState<_AttemptItem> {
  AudioPlayer? _player;

  @override
  void dispose() {
    _player?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final attempt = widget.attempt;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.person_rounded,
                    size: 16, color: theme.colorScheme.outline),
                const SizedBox(width: 4),
                Text(
                  _formatDate(attempt.attemptedAt),
                  style: TextStyle(
                      fontSize: 12, color: theme.colorScheme.outline),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.play_circle_rounded),
                  onPressed: () async {
                    _player ??= AudioPlayer();
                    await _player!.setUrl(attempt.audioUrl);
                    await _player!.play();
                  },
                  tooltip: '발음 듣기',
                ),
              ],
            ),
            if (attempt.isCorrected) ...[
              const Divider(height: 16),
              if (attempt.score != null)
                Row(
                  children: List.generate(
                    5,
                    (i) => Icon(
                      i < attempt.score!
                          ? Icons.star_rounded
                          : Icons.star_outline_rounded,
                      color: const Color(0xFFFFC107),
                      size: 20,
                    ),
                  ),
                ),
              if (attempt.correctionNote != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.secondaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    attempt.correctionNote!,
                    style: TextStyle(
                        color: theme.colorScheme.onSecondaryContainer),
                  ),
                ),
              ],
            ] else if (widget.canAddNote) ...[
              const Divider(height: 16),
              TextButton.icon(
                onPressed: () => _showNoteSheet(context),
                icon: const Icon(Icons.rate_review_outlined, size: 16),
                label: const Text('교정 메모 추가'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showNoteSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _NoteSheet(
        attemptId: widget.attempt.id,
        onNoteAdded: widget.onNoteAdded,
      ),
    );
  }

  String _formatDate(DateTime dt) {
    return '${dt.month}/${dt.day} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}

// ── Native Audio Upload Section (card creator only) ───────────────────────────

class _NativeAudioUploadSection extends StatelessWidget {
  const _NativeAudioUploadSection({
    required this.recorder,
    required this.uploading,
    required this.onSubmit,
  });

  final AudioRecorderService recorder;
  final bool uploading;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.record_voice_over_rounded,
                  color: theme.colorScheme.onSecondaryContainer),
              const SizedBox(width: 8),
              Text(
                '원어민 발음 녹음',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: theme.colorScheme.onSecondaryContainer,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '내 발음을 녹음해서 등록하면 상대방이 듣고 따라할 수 있어요.',
            style: TextStyle(
              fontSize: 12,
              color: theme.colorScheme.onSecondaryContainer.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (recorder.state == RecorderState.idle)
                FilledButton.icon(
                  onPressed: () async {
                    try {
                      await recorder.start();
                    } on RecorderPermissionException {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('마이크 권한이 필요해요')),
                        );
                      }
                    }
                  },
                  icon: const Icon(Icons.fiber_manual_record_rounded),
                  label: const Text('녹음 시작'),
                  style: FilledButton.styleFrom(
                    backgroundColor: theme.colorScheme.secondary,
                    foregroundColor: theme.colorScheme.onSecondary,
                  ),
                )
              else if (recorder.state == RecorderState.recording)
                Column(
                  children: [
                    Text(
                      recorder.formattedDuration,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: theme.colorScheme.error,
                      ),
                    ),
                    const SizedBox(height: 8),
                    FilledButton.icon(
                      onPressed: recorder.stop,
                      icon: const Icon(Icons.stop_rounded),
                      label: const Text('녹음 중지'),
                    ),
                  ],
                )
              else ...[
                IconButton.filled(
                  onPressed: recorder.reset,
                  icon: const Icon(Icons.refresh_rounded),
                  tooltip: '다시 녹음',
                ),
                const SizedBox(width: 12),
                if (uploading)
                  const CircularProgressIndicator()
                else
                  FilledButton.icon(
                    onPressed: onSubmit,
                    icon: const Icon(Icons.upload_rounded),
                    label: const Text('발음 등록'),
                    style: FilledButton.styleFrom(
                      backgroundColor: theme.colorScheme.secondary,
                      foregroundColor: theme.colorScheme.onSecondary,
                    ),
                  ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

// ── Note Sheet ────────────────────────────────────────────────────────────────

class _NoteSheet extends ConsumerStatefulWidget {
  const _NoteSheet({required this.attemptId, required this.onNoteAdded});
  final String attemptId;
  final VoidCallback onNoteAdded;

  @override
  ConsumerState<_NoteSheet> createState() => _NoteSheetState();
}

class _NoteSheetState extends ConsumerState<_NoteSheet> {
  final _noteController = TextEditingController();
  int? _selectedScore;
  bool _submitting = false;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final note = _noteController.text.trim();
    if (note.isEmpty || _submitting) return;
    setState(() => _submitting = true);
    final messenger = ScaffoldMessenger.of(context);
    final errorColor = Theme.of(context).colorScheme.error;
    try {
      await ref
          .read(cardAttemptStateProvider.notifier)
          .addNote(widget.attemptId, note, _selectedScore);
      if (!mounted) return;
      widget.onNoteAdded();
      Navigator.pop(context);
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      final msg = e.toString().contains('SESSION_002')
          ? '세션 멤버만 교정 메모를 작성할 수 있어요.'
          : '교정 메모 저장에 실패했어요. 다시 시도해 주세요.';
      messenger.showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: errorColor),
      );
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
              '교정 메모 추가',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                5,
                (i) => GestureDetector(
                  onTap: _submitting
                      ? null
                      : () => setState(() => _selectedScore = i + 1),
                  child: Icon(
                    _selectedScore != null && i < _selectedScore!
                        ? Icons.star_rounded
                        : Icons.star_outline_rounded,
                    color: const Color(0xFFFFC107),
                    size: 36,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _noteController,
              autofocus: true,
              enabled: !_submitting,
              decoration: const InputDecoration(
                labelText: '교정 메모',
                hintText: '발음, 억양, 개선점 등을 알려주세요',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
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
                    : const Text('저장'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
