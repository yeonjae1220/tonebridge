import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:tonebridge/core/services/audio_recorder_service.dart';
import 'package:tonebridge/core/utils/permission_dialogs.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/domain/model/native_audio_entry.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';

class NativeAudiosSection extends ConsumerStatefulWidget {
  const NativeAudiosSection({
    super.key,
    required this.cardId,
    required this.sessionId,
    required this.recorder,
    required this.uploading,
    required this.onSubmit,
  });

  final String cardId;
  final String sessionId;
  final AudioRecorderService recorder;
  final bool uploading;
  final VoidCallback onSubmit;

  @override
  ConsumerState<NativeAudiosSection> createState() =>
      _NativeAudiosSectionState();
}

class _NativeAudiosSectionState extends ConsumerState<NativeAudiosSection> {
  final Map<String, AudioPlayer> _players = {};

  @override
  void dispose() {
    for (final p in _players.values) {
      unawaited(p.stop());
      p.dispose();
    }
    super.dispose();
  }

  Future<void> _playAudio(NativeAudioEntry entry) async {
    try {
      final url = await ref
          .read(studySessionRepositoryProvider)
          .getNativeAudioDownloadUrlV2(entry.id);
      final player = _players.putIfAbsent(entry.id, AudioPlayer.new);
      await player.setUrl(url);
      await player.play();
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('재생 실패: $e')),
        );
      }
    }
  }

  Future<void> _deleteAudio(NativeAudioEntry entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('녹음 삭제'),
        content: const Text('이 녹음을 삭제할까요? 되돌릴 수 없어요.'),
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
    if (confirmed != true) return;
    try {
      await ref
          .read(studySessionRepositoryProvider)
          .deleteNativeAudio(widget.cardId, entry.id);
      ref.invalidate(cardNativeAudiosProvider(widget.cardId));
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('삭제 실패: 다시 시도해 주세요. ($e)')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final audiosAsync = ref.watch(cardNativeAudiosProvider(widget.cardId));

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
            '녹음을 추가하면 상대방이 듣고 따라할 수 있어요.',
            style: TextStyle(
              fontSize: 12,
              color: theme.colorScheme.onSecondaryContainer
                  .withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 16),
          audiosAsync.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (audios) {
              if (audios.isEmpty) return const SizedBox.shrink();
              return Column(
                children: [
                  ...audios.map((a) => _AudioEntryTile(
                        entry: a,
                        onPlay: () => _playAudio(a),
                        onDelete: () => _deleteAudio(a),
                      )),
                  const SizedBox(height: 12),
                ],
              );
            },
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.recorder.state == RecorderState.idle)
                FilledButton.icon(
                  onPressed: () async {
                    try {
                      await widget.recorder.start();
                    } on RecorderPermissionException catch (e) {
                      if (context.mounted) showMicPermissionError(context, e);
                    }
                  },
                  icon: const Icon(Icons.mic_rounded),
                  label: const Text('녹음 추가'),
                  style: FilledButton.styleFrom(
                    backgroundColor: theme.colorScheme.secondary,
                    foregroundColor: theme.colorScheme.onSecondary,
                  ),
                )
              else if (widget.recorder.state == RecorderState.recording)
                Column(
                  children: [
                    Text(
                      widget.recorder.formattedDuration,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: theme.colorScheme.error,
                      ),
                    ),
                    const SizedBox(height: 8),
                    FilledButton.icon(
                      onPressed: widget.recorder.stop,
                      icon: const Icon(Icons.stop_rounded),
                      label: const Text('녹음 중지'),
                    ),
                  ],
                )
              else ...[
                IconButton.filled(
                  onPressed: widget.recorder.reset,
                  icon: const Icon(Icons.refresh_rounded),
                  tooltip: '다시 녹음',
                ),
                const SizedBox(width: 12),
                if (widget.uploading)
                  const CircularProgressIndicator()
                else
                  FilledButton.icon(
                    onPressed: widget.onSubmit,
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

class _AudioEntryTile extends StatelessWidget {
  const _AudioEntryTile({
    required this.entry,
    required this.onPlay,
    required this.onDelete,
  });

  final NativeAudioEntry entry;
  final VoidCallback onPlay;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dt = entry.createdAt;
    final label =
        '${dt.month}/${dt.day} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: theme.colorScheme.onSecondaryContainer.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          IconButton(
            icon: Icon(Icons.play_circle_rounded,
                color: theme.colorScheme.secondary),
            onPressed: onPlay,
            tooltip: '재생',
          ),
          Expanded(
            child: Text(
              '녹음 $label',
              style: TextStyle(
                fontSize: 13,
                color: theme.colorScheme.onSecondaryContainer,
              ),
            ),
          ),
          IconButton(
            icon: Icon(Icons.delete_outline_rounded,
                color: theme.colorScheme.error, size: 20),
            onPressed: onDelete,
            tooltip: '삭제',
          ),
        ],
      ),
    );
  }
}
