import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/correction/data/correction_repository_impl.dart';
import 'package:tonebridge/features/correction/domain/model/correction_item.dart';
import 'package:tonebridge/features/correction/presentation/correction_provider.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';
import 'package:tonebridge/features/feed/presentation/feed_provider.dart';
import 'package:tonebridge/features/notification/sse_notification_service.dart';

class ResultPage extends ConsumerStatefulWidget {
  const ResultPage({super.key, required this.requestId});
  final String requestId;

  @override
  ConsumerState<ResultPage> createState() => _ResultPageState();
}

class _ResultPageState extends ConsumerState<ResultPage> {
  StreamSubscription<SseEvent>? _sseSub;

  // Original audio playback
  AudioPlayer? _originalPlayer;
  bool _originalReady = false;
  bool _originalPlaying = false;
  Duration _originalPosition = Duration.zero;
  Duration _originalDuration = Duration.zero;

  @override
  void initState() {
    super.initState();
    _connectSse();
  }

  void _connectSse() {
    final sseService = ref.read(sseNotificationServiceProvider);
    _sseSub = sseService.stream.listen((event) {
      if (event.type == 'correction-ready') {
        // Invalidate to trigger refetch
        ref.invalidate(correctionResultProvider(widget.requestId));
        ref.invalidate(myRequestsStateProvider);
      }
    });
  }

  Future<void> _loadOriginalAudio(String audioKey) async {
    if (_originalPlayer != null) return;
    try {
      final res = await ref
          .read(dioProvider)
          .get<Map<String, dynamic>>(
            '/api/storage/presigned-download',
            queryParameters: {'key': audioKey},
          );
      final url = res.data!['downloadUrl'] as String;
      _originalPlayer = AudioPlayer();
      await _originalPlayer!.setUrl(url);
      _originalPlayer!.durationStream.listen((d) {
        if (mounted && d != null) setState(() => _originalDuration = d);
      });
      _originalPlayer!.positionStream.listen((p) {
        if (mounted) setState(() => _originalPosition = p);
      });
      _originalPlayer!.playingStream.listen((playing) {
        if (mounted) setState(() => _originalPlaying = playing);
      });
      if (mounted) setState(() => _originalReady = true);
    } catch (_) {}
  }

  @override
  void dispose() {
    _sseSub?.cancel();
    _originalPlayer?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final strings = ref.watch(tProvider);
    final resultAsync = ref.watch(correctionResultProvider(widget.requestId));
    final currentUserId = ref.watch(authStateProvider).value?.user.id;

    // Resolve the original request from feed/my-requests
    final feedAsync = ref.watch(feedStateProvider);
    final myAsync = ref.watch(myRequestsStateProvider);
    CorrectionRequestItem? request;
    feedAsync.whenData((List<CorrectionRequestItem> items) {
      request ??= items.where((i) => i.id == widget.requestId).firstOrNull;
    });
    myAsync.whenData((List<CorrectionRequestItem> items) {
      request ??= items.where((i) => i.id == widget.requestId).firstOrNull;
    });

    final isAudio = request?.type == 'AUDIO';
    if (isAudio && request?.audioUrl != null && _originalPlayer == null) {
      _loadOriginalAudio(request!.audioUrl!);
    }

    return Scaffold(
      appBar: AppBar(title: Text(strings.resultTitle)),
      body: resultAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.error_outline_rounded,
                size: 48,
                color: theme.colorScheme.error,
              ),
              const SizedBox(height: 12),
              Text(
                strings.resultLoadFailed,
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () =>
                    ref.invalidate(correctionResultProvider(widget.requestId)),
                child: Text(strings.retry),
              ),
            ],
          ),
        ),
        data: (corrections) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── 원문 ──
            _OriginalCard(
              request: request,
              isAudio: isAudio,
              ready: _originalReady,
              playing: _originalPlaying,
              position: _originalPosition,
              duration: _originalDuration,
              onToggle: () {
                if (_originalPlaying) {
                  _originalPlayer?.pause();
                } else {
                  _originalPlayer?.play();
                }
              },
            ),
            const SizedBox(height: 16),

            // ── 교정 결과 목록 ──
            if (corrections.isEmpty) ...[
              _EmptyWaitCard(theme: theme),
            ] else ...[
              ...corrections.map(
                (c) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _CorrectionCard(
                    correction: c,
                    isAudioRequest: isAudio,
                    onRate: (helpful) => ref
                        .read(ratingStateProvider(c.id).notifier)
                        .rate(helpful: helpful),
                    onEdit: currentUserId == c.correctorId
                        ? () => _showEditCorrectionSheet(context, c, isAudio)
                        : null,
                    onDelete: currentUserId == c.correctorId
                        ? () => _confirmDeleteCorrection(context, c)
                        : null,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDeleteCorrection(
    BuildContext context,
    CorrectionItem correction,
  ) async {
    final strings = ref.read(tProvider);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(strings.correctionDeleteTitle),
        content: Text(strings.correctionDeleteConfirm),
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
      await ref
          .read(correctionRepositoryProvider)
          .deleteCorrection(correction.id);
      ref.invalidate(correctionResultProvider(widget.requestId));
      messenger.showSnackBar(
        SnackBar(content: Text(strings.correctionDeleted)),
      );
    } on Exception catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(strings.deleteFailed(e))));
    }
  }

  void _showEditCorrectionSheet(
    BuildContext context,
    CorrectionItem correction,
    bool isAudio,
  ) {
    final strings = ref.read(tProvider);
    final correctedController = TextEditingController(
      text: correction.correctedText ?? '',
    );
    final explanationController = TextEditingController(
      text: correction.explanation ?? '',
    );
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
              strings.correctionEditTitle,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            if (!isAudio) ...[
              const SizedBox(height: 16),
              TextField(
                controller: correctedController,
                autofocus: true,
                decoration: InputDecoration(
                  labelText: strings.correctedSentence,
                  border: const OutlineInputBorder(),
                ),
                maxLines: 3,
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: explanationController,
              autofocus: isAudio,
              decoration: InputDecoration(
                labelText: strings.explanation,
                border: const OutlineInputBorder(),
              ),
              maxLines: 4,
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () async {
                  final explanation = explanationController.text.trim();
                  if (explanation.isEmpty) return;
                  final navigator = Navigator.of(context);
                  final messenger = ScaffoldMessenger.of(context);
                  try {
                    await ref
                        .read(correctionRepositoryProvider)
                        .updateCorrection(
                          correctionId: correction.id,
                          correctedText: isAudio
                              ? correction.correctedText
                              : correctedController.text.trim(),
                          explanation: explanation,
                          tags: correction.tags,
                          timestampComments: correction.timestampComments,
                          pronunciationScore: correction.pronunciationScore,
                          intonationScore: correction.intonationScore,
                          fluencyScore: correction.fluencyScore,
                          referenceAudioUrl: correction.referenceAudioUrl,
                        );
                    ref.invalidate(correctionResultProvider(widget.requestId));
                    navigator.pop();
                    messenger.showSnackBar(
                      SnackBar(content: Text(strings.correctionUpdated)),
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

// ── Sub-widgets ──────────────────────────────────────────────────────────────

class _OriginalCard extends StatelessWidget {
  const _OriginalCard({
    required this.request,
    required this.isAudio,
    required this.ready,
    required this.playing,
    required this.position,
    required this.duration,
    required this.onToggle,
  });

  final CorrectionRequestItem? request;
  final bool isAudio;
  final bool ready;
  final bool playing;
  final Duration position;
  final Duration duration;
  final VoidCallback onToggle;

  String _fmt(Duration d) {
    final m = d.inMinutes.toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final strings = ProviderScope.containerOf(context).read(tProvider);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.tertiaryContainer.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: theme.colorScheme.tertiary.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                strings.myOriginal,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.tertiary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (isAudio) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.tertiary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    strings.audio,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.tertiary,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          if (isAudio) ...[
            Row(
              children: [
                FilledButton.tonal(
                  onPressed: ready ? onToggle : null,
                  child: Icon(
                    playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  '${_fmt(position)} / ${_fmt(duration)}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ] else ...[
            Text(
              request?.contentText ?? '...',
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ],
      ),
    );
  }
}

class _EmptyWaitCard extends StatelessWidget {
  const _EmptyWaitCard({required this.theme});
  final ThemeData theme;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(32),
    decoration: BoxDecoration(
      color: theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(
        color: theme.colorScheme.outline.withValues(alpha: 0.2),
      ),
    ),
    child: Column(
      children: [
        Icon(
          Icons.hourglass_top_rounded,
          size: 48,
          color: theme.colorScheme.outline,
        ),
        const SizedBox(height: 12),
        Text(
          ProviderScope.containerOf(
            context,
          ).read(tProvider).correctionWaitingTitle,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          ProviderScope.containerOf(
            context,
          ).read(tProvider).correctionWaitingSubtitle,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
      ],
    ),
  );
}

class _CorrectionCard extends StatefulWidget {
  const _CorrectionCard({
    required this.correction,
    required this.isAudioRequest,
    required this.onRate,
    this.onEdit,
    this.onDelete,
  });

  final CorrectionItem correction;
  final bool isAudioRequest;
  final ValueChanged<bool> onRate;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  @override
  State<_CorrectionCard> createState() => _CorrectionCardState();
}

class _CorrectionCardState extends State<_CorrectionCard> {
  AudioPlayer? _refPlayer;
  bool _refReady = false;
  bool _refPlaying = false;

  @override
  void dispose() {
    _refPlayer?.dispose();
    super.dispose();
  }

  Future<void> _loadRefAudio(BuildContext context, String key) async {
    if (_refPlayer != null) return;
    try {
      final dio = ProviderScope.containerOf(context).read(dioProvider);
      final res = await dio.get<Map<String, dynamic>>(
        '/api/storage/presigned-download',
        queryParameters: {'key': key},
      );
      final url = res.data!['downloadUrl'] as String;
      _refPlayer = AudioPlayer();
      await _refPlayer!.setUrl(url);
      _refPlayer!.playingStream.listen((p) {
        if (mounted) setState(() => _refPlaying = p);
      });
      if (mounted) setState(() => _refReady = true);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final strings = ProviderScope.containerOf(context).read(tProvider);
    final c = widget.correction;

    if (c.referenceAudioUrl != null && _refPlayer == null) {
      _loadRefAudio(context, c.referenceAudioUrl!);
    }

    final (statusLabel, statusColor) = switch (c.status) {
      'APPROVED' => (strings.approved, theme.colorScheme.primary),
      'REJECTED' => (strings.rejected, theme.colorScheme.error),
      _ => (strings.underReview, theme.colorScheme.outline),
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                if (c.isAi)
                  _Badge(
                    label: strings.aiCorrection,
                    color: theme.colorScheme.tertiaryContainer,
                    textColor: theme.colorScheme.onTertiaryContainer,
                  )
                else
                  _Badge(
                    label: strings.humanCorrection,
                    color: theme.colorScheme.primaryContainer,
                    textColor: theme.colorScheme.onPrimaryContainer,
                  ),
                const Spacer(),
                Text(
                  statusLabel,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: statusColor,
                  ),
                ),
                if (widget.onEdit != null || widget.onDelete != null)
                  PopupMenuButton<String>(
                    onSelected: (value) {
                      if (value == 'edit') {
                        widget.onEdit?.call();
                      } else if (value == 'delete') {
                        widget.onDelete?.call();
                      }
                    },
                    itemBuilder: (_) => [
                      if (widget.onEdit != null)
                        PopupMenuItem(
                          value: 'edit',
                          child: Row(
                            children: [
                              const Icon(Icons.edit_outlined),
                              const SizedBox(width: 8),
                              Text(strings.edit),
                            ],
                          ),
                        ),
                      if (widget.onDelete != null)
                        PopupMenuItem(
                          value: 'delete',
                          child: Row(
                            children: [
                              const Icon(Icons.delete_outline),
                              const SizedBox(width: 8),
                              Text(strings.delete),
                            ],
                          ),
                        ),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 12),

            // Scores (audio)
            if (_hasScores(c)) ...[
              _ScoreRow(
                pronunciation: c.pronunciationScore,
                intonation: c.intonationScore,
                fluency: c.fluencyScore,
              ),
              const SizedBox(height: 12),
            ],

            // Timestamp comments (audio)
            if (c.timestampComments.isNotEmpty) ...[
              Text(
                strings.segmentComments,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
              const SizedBox(height: 6),
              ...c.timestampComments.map((tc) => _TimestampRow(tc: tc)),
              const SizedBox(height: 12),
            ],

            // Reference audio
            if (c.referenceAudioUrl != null) ...[
              Text(
                strings.nativeReRecording,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              FilledButton.tonal(
                onPressed: _refReady
                    ? () {
                        if (_refPlaying) {
                          _refPlayer?.pause();
                        } else {
                          _refPlayer?.play();
                        }
                      }
                    : null,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _refPlaying
                          ? Icons.pause_rounded
                          : Icons.play_arrow_rounded,
                    ),
                    const SizedBox(width: 8),
                    Text(_refPlaying ? strings.pause : strings.play),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Corrected text (text requests)
            if (!widget.isAudioRequest && c.correctedText != null) ...[
              Text(
                strings.correctedSentence,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: Colors.green.shade700,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  c.correctedText!,
                  style: theme.textTheme.bodyMedium,
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Explanation
            if (c.explanation?.isNotEmpty ?? false) ...[
              Text(
                strings.explanation,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(c.explanation!, style: theme.textTheme.bodyMedium),
              const SizedBox(height: 12),
            ],

            // Tags
            if (c.tags.isNotEmpty) ...[
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: c.tags
                    .map(
                      (t) => Chip(
                        label: Text(t),
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        visualDensity: VisualDensity.compact,
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 12),
            ],

            // Rating
            if (c.status == 'APPROVED') ...[
              const Divider(),
              const SizedBox(height: 8),
              Row(
                children: [
                  Text(
                    strings.ratingQuestion,
                    style: theme.textTheme.bodySmall,
                  ),
                  const Spacer(),
                  IconButton.filledTonal(
                    onPressed: () => widget.onRate(true),
                    icon: const Icon(Icons.thumb_up_rounded, size: 18),
                    visualDensity: VisualDensity.compact,
                  ),
                  const SizedBox(width: 8),
                  IconButton.filledTonal(
                    onPressed: () => widget.onRate(false),
                    icon: const Icon(Icons.thumb_down_rounded, size: 18),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  bool _hasScores(CorrectionItem c) =>
      c.pronunciationScore != null ||
      c.intonationScore != null ||
      c.fluencyScore != null;
}

class _TimestampRow extends StatelessWidget {
  const _TimestampRow({required this.tc});
  final TimestampComment tc;

  String _fmt(int ms) {
    final d = Duration(milliseconds: ms);
    final m = d.inMinutes.toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _fmt(tc.offsetMs),
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.primary,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(width: 8),
          if (tc.category.isNotEmpty)
            Chip(
              label: Text(tc.category),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
            ),
          const SizedBox(width: 8),
          Expanded(child: Text(tc.comment, style: theme.textTheme.bodySmall)),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({
    required this.label,
    required this.color,
    required this.textColor,
  });
  final String label;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      label,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
        color: textColor,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class _ScoreRow extends StatelessWidget {
  const _ScoreRow({this.pronunciation, this.intonation, this.fluency});
  final int? pronunciation;
  final int? intonation;
  final int? fluency;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final strings = ProviderScope.containerOf(context).read(tProvider);
    return Row(
      children: [
        if (pronunciation != null)
          _ScoreChip(
            label: strings.pronunciation,
            score: pronunciation!,
            theme: theme,
          ),
        if (intonation != null)
          _ScoreChip(
            label: strings.intonation,
            score: intonation!,
            theme: theme,
          ),
        if (fluency != null)
          _ScoreChip(label: strings.fluency, score: fluency!, theme: theme),
      ],
    );
  }
}

class _ScoreChip extends StatelessWidget {
  const _ScoreChip({
    required this.label,
    required this.score,
    required this.theme,
  });
  final String label;
  final int score;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 12),
    child: Column(
      children: [
        Text(
          '$score/10',
          style: theme.textTheme.titleMedium?.copyWith(
            color: theme.colorScheme.primary,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(label, style: theme.textTheme.labelSmall),
      ],
    ),
  );
}
