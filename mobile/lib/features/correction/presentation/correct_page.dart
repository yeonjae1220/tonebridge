import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:just_audio/just_audio.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/core/services/audio_recorder_service.dart';
import 'package:tonebridge/core/services/presigned_upload_service.dart';
import 'package:tonebridge/features/correction/presentation/correction_provider.dart';
import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';
import 'package:tonebridge/features/feed/presentation/feed_provider.dart';

const _tagOptions = ['문법', '자연스러움', '원어민 표현', '발음', '억양', '포멀', '캐주얼'];
const _timestampCategories = ['발음', '억양', '속도', '강세', '연음'];

class CorrectPage extends ConsumerStatefulWidget {
  const CorrectPage({super.key, required this.requestId});
  final String requestId;

  @override
  ConsumerState<CorrectPage> createState() => _CorrectPageState();
}

class _CorrectPageState extends ConsumerState<CorrectPage> {
  final _formKey = GlobalKey<FormState>();
  final _correctedTextController = TextEditingController();
  final _explanationController = TextEditingController();
  final _timestampCommentController = TextEditingController();

  String _timestampCategory = _timestampCategories.first;
  final List<_TsComment> _timestampComments = [];
  int _pronunciationScore = 5;
  int _intonationScore = 5;
  int _fluencyScore = 5;
  final List<String> _tags = [];
  bool _uploading = false;

  // Audio playback for original request
  AudioPlayer? _originalPlayer;
  bool _originalReady = false;
  bool _originalPlaying = false;
  Duration _originalPosition = Duration.zero;
  Duration _originalDuration = Duration.zero;

  // Reference re-recording by native speaker
  late final AudioRecorderService _refRecorder;
  AudioPlayer? _refPlaybackPlayer;

  @override
  void initState() {
    super.initState();
    _refRecorder = AudioRecorderService();
    _refRecorder.addListener(_onRefRecorderChange);
  }

  void _onRefRecorderChange() => setState(() {});

  @override
  void dispose() {
    _correctedTextController.dispose();
    _explanationController.dispose();
    _timestampCommentController.dispose();
    _originalPlayer?.dispose();
    _refRecorder.removeListener(_onRefRecorderChange);
    _refRecorder.dispose();
    _refPlaybackPlayer?.dispose();
    super.dispose();
  }

  Future<void> _loadAudio(String audioKey) async {
    if (_originalPlayer != null) return;
    try {
      final res = await ref.read(dioProvider).get<Map<String, dynamic>>(
        '/api/storage/presigned-download',
        queryParameters: {'key': audioKey},
      );
      final url = res.data!['downloadUrl'] as String;
      _originalPlayer = AudioPlayer();
      await _originalPlayer!.setUrl(url);
      _originalPlayer!.durationStream.listen((d) {
        if (mounted && d != null) {
          setState(() => _originalDuration = d);
        }
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
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final submitAsync = ref.watch(submitCorrectionStateProvider);
    final isLoading = submitAsync.isLoading || _uploading;

    // Fetch the request from the feed cache
    final feedAsync = ref.watch(feedStateProvider);
    final myAsync = ref.watch(myRequestsStateProvider);

    CorrectionRequestItem? request;
    feedAsync.whenData((List<CorrectionRequestItem> items) {
      request ??=
          items.where((i) => i.id == widget.requestId).firstOrNull;
    });
    myAsync.whenData((List<CorrectionRequestItem> items) {
      request ??=
          items.where((i) => i.id == widget.requestId).firstOrNull;
    });

    final isAudio = request?.type == 'AUDIO';

    if (isAudio && request?.audioUrl != null && _originalPlayer == null) {
      _loadAudio(request!.audioUrl!);
    }

    ref.listen(submitCorrectionStateProvider, (previous, next) {
      if (next.hasError && !(previous?.hasError ?? false) && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('교정 제출에 실패했습니다.'),
            backgroundColor: theme.colorScheme.error,
          ),
        );
      }
      if (next.hasValue && next.value != null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('교정이 제출됐습니다!')),
        );
        ref.read(submitCorrectionStateProvider.notifier).reset();
        if (!mounted) return;
        context.go(AppRoute.feed);
      }
    });

    final explanationLen = _explanationController.text.length;
    final isValid = explanationLen >= 20;
    final reward =
        isAudio ? (_refRecorder.state == RecorderState.stopped ? 12 : 8) : 4;

    return Scaffold(
      appBar: AppBar(
        title: const Text('첨삭 작성'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(20),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              '완료 시 +$reward 크레딧',
              style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.primary),
            ),
          ),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // ── 원문 ──
            _OriginalSection(
              request: request,
              isAudio: isAudio,
              ready: _originalReady,
              playing: _originalPlaying,
              position: _originalPosition,
              duration: _originalDuration,
              onTogglePlay: _togglePlay,
            ),
            const SizedBox(height: 20),

            // ── 타임스탬프 코멘트 (음성만) ──
            if (isAudio) ...[
              _TimestampSection(
                comments: _timestampComments,
                category: _timestampCategory,
                categoryOptions: _timestampCategories,
                controller: _timestampCommentController,
                currentPosition: _originalPosition,
                isPlayerReady: _originalReady,
                onCategoryChanged: (v) =>
                    setState(() => _timestampCategory = v),
                onAdd: _addTimestampComment,
                onRemove: (i) =>
                    setState(() => _timestampComments.removeAt(i)),
                onSeek: (pos) => _originalPlayer?.seek(pos),
              ),
              const SizedBox(height: 20),

              // ── 점수 평가 (음성만) ──
              _SectionLabel(label: '점수 평가'),
              const SizedBox(height: 8),
              _ScoreSlider(
                label: '발음 정확도',
                value: _pronunciationScore,
                onChanged: (v) => setState(() => _pronunciationScore = v),
              ),
              _ScoreSlider(
                label: '억양 자연스러움',
                value: _intonationScore,
                onChanged: (v) => setState(() => _intonationScore = v),
              ),
              _ScoreSlider(
                label: '이해 가능성',
                value: _fluencyScore,
                onChanged: (v) => setState(() => _fluencyScore = v),
              ),
              const SizedBox(height: 20),

              // ── 원어민 재녹음 ──
              _RefRecordingSection(
                recorder: _refRecorder,
                onPlayback: _startRefPlayback,
              ),
              const SizedBox(height: 20),
            ],

            // ── 수정 문장 (텍스트만) ──
            if (!isAudio) ...[
              _SectionLabel(label: '수정 문장'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _correctedTextController,
                minLines: 3,
                maxLines: 6,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: '자연스럽게 수정한 문장을 입력하세요',
                ),
              ),
              const SizedBox(height: 20),
            ],

            // ── 설명 ──
            Row(
              children: [
                const _SectionLabel(label: '설명 *'),
                const Spacer(),
                Text(
                  '$explanationLen/20 최소',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: isValid
                        ? theme.colorScheme.primary
                        : theme.colorScheme.outline,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _explanationController,
              minLines: 3,
              maxLines: 6,
              decoration: InputDecoration(
                border: const OutlineInputBorder(),
                hintText: isAudio
                    ? '발음, 억양, 속도 등에 대한 피드백을 작성해주세요...'
                    : '왜 어색한지, 어떻게 고쳐야 하는지 설명해주세요...',
              ),
              onChanged: (_) => setState(() {}),
              validator: (v) {
                if (v == null || v.trim().length < 20) {
                  return '설명은 20자 이상 작성해주세요';
                }
                return null;
              },
            ),
            const SizedBox(height: 20),

            // ── 태그 ──
            _SectionLabel(label: '태그 (선택)'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _tagOptions.map((t) {
                final selected = _tags.contains(t);
                return FilterChip(
                  label: Text(t),
                  selected: selected,
                  onSelected: (v) => setState(() {
                    if (v) {
                      _tags.add(t);
                    } else {
                      _tags.remove(t);
                    }
                  }),
                );
              }).toList(),
            ),
            const SizedBox(height: 32),

            FilledButton(
              onPressed: (isLoading || !isValid) ? null : _submit,
              style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14)),
              child: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('첨삭 제출'),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  void _togglePlay() {
    if (_originalPlayer == null) return;
    if (_originalPlaying) {
      _originalPlayer!.pause();
    } else {
      _originalPlayer!.play();
    }
  }

  void _addTimestampComment() {
    final text = _timestampCommentController.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _timestampComments.add(_TsComment(
        offsetMs: _originalPosition.inMilliseconds,
        category: _timestampCategory,
        comment: text,
      ));
      _timestampCommentController.clear();
    });
  }

  Future<void> _startRefPlayback() async {
    final path = _refRecorder.filePath;
    if (path == null) return;
    _refPlaybackPlayer?.dispose();
    _refPlaybackPlayer = AudioPlayer();
    await _refPlaybackPlayer!.setFilePath(path);
    await _refPlaybackPlayer!.play();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    String? referenceAudioUrl;
    if (_refRecorder.state == RecorderState.stopped &&
        _refRecorder.file != null) {
      setState(() => _uploading = true);
      try {
        final uploader =
            PresignedUploadService(dio: ref.read(dioProvider));
        referenceAudioUrl = await uploader.upload(
          file: _refRecorder.file!,
          fileName: 'ref_${DateTime.now().millisecondsSinceEpoch}.aac',
        );
      } finally {
        if (mounted) setState(() => _uploading = false);
      }
    }

    final isAudio =
        _timestampComments.isNotEmpty || _pronunciationScore != 5;

    ref.read(submitCorrectionStateProvider.notifier).submit(
          requestId: widget.requestId,
          correctedText: _correctedTextController.text.trim().isEmpty
              ? null
              : _correctedTextController.text.trim(),
          explanation: _explanationController.text.trim(),
          tags: List.from(_tags),
          timestampComments: _timestampComments
              .map((t) => TimestampCommentInput(
                    offsetMs: t.offsetMs,
                    comment: t.comment,
                    category: t.category,
                  ))
              .toList(),
          pronunciationScore: isAudio ? _pronunciationScore : null,
          intonationScore: isAudio ? _intonationScore : null,
          fluencyScore: isAudio ? _fluencyScore : null,
          referenceAudioUrl: referenceAudioUrl,
        );
  }
}

class _TsComment {
  const _TsComment({
    required this.offsetMs,
    required this.category,
    required this.comment,
  });
  final int offsetMs;
  final String category;
  final String comment;
}

// ── Section widgets ──────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Text(
        label,
        style: Theme.of(context)
            .textTheme
            .titleSmall
            ?.copyWith(fontWeight: FontWeight.w600),
      );
}

class _OriginalSection extends StatelessWidget {
  const _OriginalSection({
    required this.request,
    required this.isAudio,
    required this.ready,
    required this.playing,
    required this.position,
    required this.duration,
    required this.onTogglePlay,
  });

  final CorrectionRequestItem? request;
  final bool isAudio;
  final bool ready;
  final bool playing;
  final Duration position;
  final Duration duration;
  final VoidCallback onTogglePlay;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.tertiaryContainer.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color:
              theme.colorScheme.tertiary.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                '원문',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.tertiary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (isAudio) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.tertiary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '음성',
                    style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.tertiary),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          if (isAudio) ...[
            _AudioPlayerBar(
              ready: ready,
              playing: playing,
              position: position,
              duration: duration,
              onToggle: onTogglePlay,
              color: theme.colorScheme.tertiary,
            ),
          ] else ...[
            Text(
              request?.contentText ?? '...',
              style: theme.textTheme.bodyMedium,
            ),
          ],
          if (request?.context != null && request!.context!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              '"${request!.context}"',
              style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.outline,
                  fontStyle: FontStyle.italic),
            ),
          ],
          if (request != null && request!.feedbackGoals.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              children: request!.feedbackGoals
                  .map((g) => Chip(
                        label: Text(g),
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        visualDensity: VisualDensity.compact,
                      ))
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _AudioPlayerBar extends StatelessWidget {
  const _AudioPlayerBar({
    required this.ready,
    required this.playing,
    required this.position,
    required this.duration,
    required this.onToggle,
    required this.color,
  });

  final bool ready;
  final bool playing;
  final Duration position;
  final Duration duration;
  final VoidCallback onToggle;
  final Color color;

  String _fmt(Duration d) {
    final m = d.inMinutes.toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    return Row(
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
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

class _TimestampSection extends StatelessWidget {
  const _TimestampSection({
    required this.comments,
    required this.category,
    required this.categoryOptions,
    required this.controller,
    required this.currentPosition,
    required this.isPlayerReady,
    required this.onCategoryChanged,
    required this.onAdd,
    required this.onRemove,
    required this.onSeek,
  });

  final List<_TsComment> comments;
  final String category;
  final List<String> categoryOptions;
  final TextEditingController controller;
  final Duration currentPosition;
  final bool isPlayerReady;
  final ValueChanged<String> onCategoryChanged;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemove;
  final ValueChanged<Duration> onSeek;

  String _fmt(int ms) {
    final d = Duration(milliseconds: ms);
    final m = d.inMinutes.toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionLabel(label: '구간 코멘트'),
        const SizedBox(height: 4),
        Text(
          '재생 중 원하는 위치에서 코멘트를 추가하세요',
          style: theme.textTheme.bodySmall
              ?.copyWith(color: theme.colorScheme.outline),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            DropdownButton<String>(
              value: category,
              underline: const SizedBox(),
              items: categoryOptions
                  .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                  .toList(),
              onChanged: (v) => v != null ? onCategoryChanged(v) : null,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: controller,
                decoration: InputDecoration(
                  hintText: '코멘트 입력...',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10)),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 8),
                  isDense: true,
                ),
                onSubmitted: (_) => onAdd(),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: isPlayerReady ? onAdd : null,
              style: FilledButton.styleFrom(
                minimumSize: const Size(40, 40),
                padding: EdgeInsets.zero,
              ),
              child: const Icon(Icons.add, size: 20),
            ),
          ],
        ),
        if (comments.isNotEmpty) ...[
          const SizedBox(height: 10),
          ...comments.asMap().entries.map((e) {
            final i = e.key;
            final tc = e.value;
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () =>
                        onSeek(Duration(milliseconds: tc.offsetMs)),
                    child: Text(
                      _fmt(tc.offsetMs),
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.primary,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Chip(
                    label: Text(tc.category),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(tc.comment,
                        style: theme.textTheme.bodySmall),
                  ),
                  IconButton(
                    icon:
                        const Icon(Icons.close_rounded, size: 18),
                    onPressed: () => onRemove(i),
                    color: theme.colorScheme.outline,
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            );
          }),
        ],
      ],
    );
  }
}

class _ScoreSlider extends StatelessWidget {
  const _ScoreSlider({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 96,
            child: Text(label, style: theme.textTheme.bodySmall),
          ),
          Expanded(
            child: Slider(
              value: value.toDouble(),
              min: 1,
              max: 10,
              divisions: 9,
              label: '$value',
              onChanged: (v) => onChanged(v.round()),
            ),
          ),
          SizedBox(
            width: 32,
            child: Text(
              '$value',
              style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: theme.colorScheme.primary),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}

class _RefRecordingSection extends StatelessWidget {
  const _RefRecordingSection({
    required this.recorder,
    required this.onPlayback,
  });

  final AudioRecorderService recorder;
  final VoidCallback onPlayback;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const _SectionLabel(label: '원어민 재녹음 (선택)'),
            const Spacer(),
            Text(
              '+4 추가 크레딧',
              style: theme.textTheme.labelSmall?.copyWith(
                  color: Colors.green.shade600,
                  fontWeight: FontWeight.w600),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          '직접 올바른 발음을 녹음해 보여주세요',
          style: theme.textTheme.bodySmall
              ?.copyWith(color: theme.colorScheme.outline),
        ),
        const SizedBox(height: 10),
        switch (recorder.state) {
          RecorderState.idle => FilledButton.tonal(
              onPressed: () => recorder.start(),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.mic_rounded, size: 18),
                  SizedBox(width: 8),
                  Text('녹음 시작'),
                ],
              ),
            ),
          RecorderState.recording => Row(
              children: [
                FilledButton(
                  onPressed: () => recorder.stop(),
                  style: FilledButton.styleFrom(
                    backgroundColor: theme.colorScheme.error,
                    foregroundColor: theme.colorScheme.onError,
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.stop_rounded, size: 18),
                      SizedBox(width: 8),
                      Text('중지'),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  recorder.formattedDuration,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          RecorderState.stopped => Row(
              children: [
                FilledButton.tonal(
                  onPressed: onPlayback,
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.play_arrow_rounded, size: 18),
                      SizedBox(width: 8),
                      Text('재생'),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                TextButton(
                  onPressed: () => recorder.reset(),
                  child: const Text('다시 녹음'),
                ),
              ],
            ),
        },
      ],
    );
  }
}
