import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/core/services/audio_recorder_service.dart';
import 'package:tonebridge/core/services/presigned_upload_service.dart';
import 'package:tonebridge/core/utils/permission_dialogs.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';

class VoiceCardSheet extends ConsumerStatefulWidget {
  const VoiceCardSheet({super.key, required this.sessionId});
  final String sessionId;

  @override
  ConsumerState<VoiceCardSheet> createState() => _VoiceCardSheetState();
}

class _VoiceCardSheetState extends ConsumerState<VoiceCardSheet> {
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
    _recorder.dispose();
    _phraseController.dispose();
    super.dispose();
  }

  Future<void> _startRecording() async {
    try {
      await _recorder.start();
    } on RecorderPermissionException catch (e) {
      if (mounted) {
        showMicPermissionError(context, e);
        Navigator.of(context).pop();
      }
    }
  }

  Future<void> _createCard() async {
    final hasRecording =
        kIsWeb ? _recorder.webBlobUrl != null : _recorder.file != null;
    if (!hasRecording) return;
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

      final ext = kIsWeb ? 'webm' : 'aac';
      final fileName = 'native_${DateTime.now().millisecondsSinceEpoch}.$ext';
      final urls = await repo.getNativeAudioUploadUrlV2(card.id, fileName);

      final uploader = PresignedUploadService(dio: ref.read(dioProvider));
      if (kIsWeb) {
        final bytes = await _recorder.getWebBytes();
        await uploader.uploadBytesToUrl(
          bytes: bytes!,
          uploadUrl: urls['uploadUrl']!,
        );
      } else {
        await uploader.uploadToUrl(
          file: _recorder.file!,
          uploadUrl: urls['uploadUrl']!,
        );
      }

      await repo.confirmNativeAudioV2(card.id, urls['audioKey']!);
      ref.invalidate(sessionCardsProvider(widget.sessionId));

      if (!mounted) return;
      Navigator.of(context).pop();
      router.push(AppRoute.cardDetail(widget.sessionId, card.id));
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() => _uploading = false);
      // Card was created but audio upload failed — user can re-record from card detail.
      messenger.showSnackBar(
        SnackBar(
          content: Text(
              '음성 업로드에 실패했어요. 카드는 생성됐으니 카드 상세에서 다시 녹음할 수 있어요. ($e)'),
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
