import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:just_audio/just_audio.dart';
import 'package:tonebridge/core/config/app_config.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/core/services/audio_recorder_service.dart';
import 'package:tonebridge/core/services/presigned_upload_service.dart';
import 'package:tonebridge/core/widgets/language_picker/language_picker.dart';
import 'package:tonebridge/features/feed/presentation/feed_provider.dart';
import 'package:tonebridge/features/request/presentation/request_provider.dart';

const _kFeedbackGoals = ['발음', '문법', '자연스러움', '억양', '캐주얼', '비즈니스'];

class RequestPage extends ConsumerStatefulWidget {
  const RequestPage({super.key});

  @override
  ConsumerState<RequestPage> createState() => _RequestPageState();
}

class _RequestPageState extends ConsumerState<RequestPage> {
  final _formKey = GlobalKey<FormState>();
  final _textController = TextEditingController();
  final _contextController = TextEditingController();

  String _targetLanguage = '';
  String? _targetVariant;
  final List<String> _feedbackGoals = [];
  bool _isAudio = false;
  bool _uploading = false;

  late final AudioRecorderService _recorder;
  AudioPlayer? _playbackPlayer;

  @override
  void initState() {
    super.initState();
    _textController.addListener(_onFormChanged);
    _recorder = AudioRecorderService();
    _recorder.addListener(_onRecorderChange);
  }

  void _onRecorderChange() => setState(() {});

  void _onFormChanged() => setState(() {});

  @override
  void dispose() {
    _textController.removeListener(_onFormChanged);
    _textController.dispose();
    _contextController.dispose();
    _recorder.removeListener(_onRecorderChange);
    _recorder.dispose();
    _playbackPlayer?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final requestAsync = ref.watch(requestStateProvider);
    final isLoading = requestAsync.isLoading || _uploading;

    ref.listen(requestStateProvider, (previous, next) {
      if (next.hasError && !(previous?.hasError ?? false) && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.error.toString()),
            backgroundColor: theme.colorScheme.error,
          ),
        );
      }
      if (next.hasValue && next.value != null) {
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('교정 요청이 등록됐습니다!')));
        ref.invalidate(feedStateProvider);
        ref.invalidate(myRequestsStateProvider);
        ref.read(requestStateProvider.notifier).reset();
        if (!mounted) return;
        context.go(AppRoute.feed);
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text('교정 요청')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // ── 요청 유형 탭 ──
            _SegmentRow(
              isAudio: _isAudio,
              onChanged: (v) => setState(() {
                _isAudio = v;
                _recorder.reset();
              }),
            ),
            const SizedBox(height: 24),

            // ── 언어 선택 ──
            _SectionCard(
              label: '교정 언어',
              child: LanguagePicker(
                value: _targetLanguage,
                variant: _targetVariant,
                onChanged: (code) => setState(() {
                  _targetLanguage = code;
                  _targetVariant = null;
                }),
                onVariantChanged: (v) => setState(() => _targetVariant = v),
              ),
            ),
            const SizedBox(height: 16),

            // ── 내용 ──
            if (!_isAudio) ...[
              _SectionCard(
                label: '교정받을 내용',
                child: Column(
                  children: [
                    TextFormField(
                      controller: _textController,
                      minLines: 4,
                      maxLines: 8,
                      maxLength: 1000,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        hintText: '교정받고 싶은 문장을 입력하세요',
                      ),
                      validator: (v) =>
                          (v == null || v.trim().isEmpty) ? '내용을 입력해주세요' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _contextController,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        hintText: '문맥 (선택) — 예: 일본 회사에 이메일을 보낼 때...',
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              _SectionCard(
                label: '음성 녹음',
                child: Column(
                  children: [
                    _AudioRecorderWidget(
                      recorder: _recorder,
                      onStart: _startRecording,
                      onPlayback: _startPlayback,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _contextController,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        hintText: '문맥 (선택) — 예: 일본 친구에게 전화할 때...',
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),

            // ── 피드백 목표 ──
            _SectionCard(
              label: '피드백 목표 (선택)',
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _kFeedbackGoals.map((g) {
                  final selected = _feedbackGoals.contains(g);
                  return FilterChip(
                    label: Text(g),
                    selected: selected,
                    onSelected: (v) => setState(() {
                      if (v) {
                        _feedbackGoals.add(g);
                      } else {
                        _feedbackGoals.remove(g);
                      }
                    }),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 16),

            // ── 크레딧 비용 ──
            _CreditBanner(isAudio: _isAudio),
            const SizedBox(height: 20),

            // ── 제출 ──
            FilledButton(
              onPressed: isLoading
                  ? null
                  : _canSubmit
                  ? _submit
                  : null,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('교정 요청 제출'),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  bool get _canSubmit {
    if (_targetLanguage.isEmpty) return false;
    if (_isAudio) return _recorder.state == RecorderState.stopped;
    return _textController.text.trim().isNotEmpty;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final context = _contextController.text.trim();

    if (_isAudio) {
      final hasRecording = kIsWeb
          ? _recorder.webBlobUrl != null
          : _recorder.file != null;
      if (!hasRecording) return;
      setState(() => _uploading = true);
      try {
        final uploader = PresignedUploadService(dio: ref.read(dioProvider));
        const ext = kIsWeb ? 'webm' : 'm4a';
        final fileName = 'audio_${DateTime.now().millisecondsSinceEpoch}.$ext';
        final String key;
        if (kIsWeb) {
          key = await uploader.uploadBytes(
            bytes: await _recorder.getWebBytes(),
            fileName: fileName,
          );
        } else {
          key = await uploader.upload(
            file: _recorder.file!,
            fileName: fileName,
          );
        }
        await ref
            .read(requestStateProvider.notifier)
            .submitAudio(
              targetLanguage: _targetLanguage,
              targetVariant: _targetVariant,
              audioKey: key,
              context: context.isEmpty ? null : context,
              feedbackGoals: List.from(_feedbackGoals),
            );
      } on Exception catch (e) {
        if (mounted) {
          _showError('교정 요청 제출에 실패했어요. ${_friendlyError(e)}');
        }
      } finally {
        if (mounted) setState(() => _uploading = false);
      }
    } else {
      ref
          .read(requestStateProvider.notifier)
          .submitText(
            targetLanguage: _targetLanguage,
            targetVariant: _targetVariant,
            contentText: _textController.text.trim(),
            context: context.isEmpty ? null : context,
            feedbackGoals: List.from(_feedbackGoals),
          );
    }
  }

  Future<void> _startPlayback() async {
    try {
      await _playbackPlayer?.stop();
      await _playbackPlayer?.dispose();
      _playbackPlayer = AudioPlayer();
      if (kIsWeb) {
        final blobUrl = _recorder.webBlobUrl;
        if (blobUrl == null) return;
        await _playbackPlayer!.setUrl(blobUrl);
      } else {
        final path = _recorder.file?.path;
        if (path == null) return;
        await _playbackPlayer!.setFilePath(path);
      }
      await _playbackPlayer!.play();
    } on Exception catch (e) {
      if (!mounted) return;
      _showError('녹음 재생에 실패했어요. ${_friendlyError(e)}');
    }
  }

  Future<void> _startRecording() async {
    try {
      await _recorder.start();
    } on RecorderPermissionException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Theme.of(context).colorScheme.error,
      ),
    );
  }

  String _friendlyError(Exception e) {
    final text = e.toString();
    if (text.contains('401') || text.contains('403')) return '다시 로그인해 주세요.';
    if (text.contains('400')) return '요청 내용을 확인해 주세요.';
    if (text.toLowerCase().contains('timeout')) {
      return '네트워크 상태를 확인해 주세요.';
    }
    return '잠시 후 다시 시도해 주세요.';
  }
}

// ── Sub-widgets ─────────────────────────────────────────────────────────────

class _SegmentRow extends StatelessWidget {
  const _SegmentRow({required this.isAudio, required this.onChanged});
  final bool isAudio;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<bool>(
      segments: const [
        ButtonSegment(
          value: false,
          icon: Icon(Icons.text_fields_rounded),
          label: Text('텍스트'),
        ),
        ButtonSegment(
          value: true,
          icon: Icon(Icons.mic_rounded),
          label: Text('음성'),
        ),
      ],
      selected: {isAudio},
      onSelectionChanged: (s) => onChanged(s.first),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.label, required this.child});
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        child,
      ],
    );
  }
}

class _CreditBanner extends StatelessWidget {
  const _CreditBanner({required this.isAudio});
  final bool isAudio;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cost = isAudio
        ? AppConfig.audioRequestCost
        : AppConfig.textRequestCost;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.toll_rounded, color: theme.colorScheme.primary, size: 20),
          const SizedBox(width: 8),
          Text(
            '크레딧 $cost 차감',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _AudioRecorderWidget extends StatelessWidget {
  const _AudioRecorderWidget({
    required this.recorder,
    required this.onStart,
    required this.onPlayback,
  });

  final AudioRecorderService recorder;
  final Future<void> Function() onStart;
  final VoidCallback onPlayback;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return switch (recorder.state) {
      RecorderState.idle => _RecordButton(onTap: onStart, theme: theme),
      RecorderState.recording => _RecordingIndicator(
        duration: recorder.formattedDuration,
        onStop: () => recorder.stop(),
        theme: theme,
      ),
      RecorderState.stopped => _RecordingStopped(
        duration: recorder.formattedDuration,
        onPlayback: onPlayback,
        onReset: () => recorder.reset(),
        theme: theme,
      ),
    };
  }
}

class _RecordButton extends StatelessWidget {
  const _RecordButton({required this.onTap, required this.theme});
  final VoidCallback onTap;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) => Center(
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: theme.colorScheme.error,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: theme.colorScheme.error.withValues(alpha: 0.3),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Icon(
          Icons.mic_rounded,
          color: theme.colorScheme.onError,
          size: 32,
        ),
      ),
    ),
  );
}

class _RecordingIndicator extends StatelessWidget {
  const _RecordingIndicator({
    required this.duration,
    required this.onStop,
    required this.theme,
  });
  final String duration;
  final VoidCallback onStop;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      GestureDetector(
        onTap: onStop,
        child: Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: theme.colorScheme.error,
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.stop_rounded,
            color: theme.colorScheme.onError,
            size: 32,
          ),
        ),
      ),
      const SizedBox(height: 12),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: theme.colorScheme.error,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            duration,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '녹음 중',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
        ],
      ),
    ],
  );
}

class _RecordingStopped extends StatelessWidget {
  const _RecordingStopped({
    required this.duration,
    required this.onPlayback,
    required this.onReset,
    required this.theme,
  });
  final String duration;
  final VoidCallback onPlayback;
  final VoidCallback onReset;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: theme.colorScheme.secondaryContainer,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(Icons.audio_file_rounded, color: theme.colorScheme.secondary),
            const SizedBox(width: 12),
            Text(
              duration,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            const Spacer(),
            IconButton(
              icon: const Icon(Icons.play_arrow_rounded),
              onPressed: onPlayback,
              color: theme.colorScheme.primary,
            ),
          ],
        ),
      ),
      const SizedBox(height: 8),
      TextButton.icon(
        onPressed: onReset,
        icon: const Icon(Icons.refresh_rounded, size: 16),
        label: const Text('다시 녹음'),
      ),
    ],
  );
}
