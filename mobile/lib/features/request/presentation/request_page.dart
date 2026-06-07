import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:just_audio/just_audio.dart';
import 'package:tonebridge/core/config/app_config.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/core/services/audio_recorder_service.dart';
import 'package:tonebridge/core/services/presigned_upload_service.dart';
import 'package:tonebridge/core/widgets/language_picker/language_picker.dart';
import 'package:tonebridge/features/feed/presentation/feed_provider.dart';
import 'package:tonebridge/features/friend/domain/model/friend.dart';
import 'package:tonebridge/features/friend/presentation/friend_provider.dart';
import 'package:tonebridge/features/request/presentation/request_provider.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/domain/model/study_session.dart';
import 'package:tonebridge/features/study_session/domain/study_session_repository.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';

const _kFeedbackGoals = ['발음', '문법', '자연스러움', '억양', '캐주얼', '비즈니스'];

enum _RequestDestination { personal, friend, community }

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
  bool _submittingStudy = false;
  _RequestDestination _destination = _RequestDestination.personal;
  String _selectedFriendId = '';

  late final AudioRecorderService _recorder;

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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final strings = ref.watch(tProvider);
    final requestAsync = ref.watch(requestStateProvider);
    final friendsAsync = ref.watch(friendListStateProvider);
    final friends = friendsAsync.value ?? const <Friend>[];
    final isLoading = requestAsync.isLoading || _uploading || _submittingStudy;

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
        ).showSnackBar(SnackBar(content: Text(strings.requestSuccess)));
        ref.invalidate(feedStateProvider);
        ref.invalidate(myRequestsStateProvider);
        ref.read(requestStateProvider.notifier).reset();
        if (!mounted) return;
        context.go(AppRoute.community);
      }
    });

    return Scaffold(
      appBar: AppBar(title: Text(strings.requestTitle)),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Text(
                strings.requestSubtitle,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            // ── 요청 유형 탭 ──
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                strings.requestTypeQuestion,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            _SegmentRow(
              isAudio: _isAudio,
              onChanged: (v) => setState(() {
                _isAudio = v;
                _recorder.reset();
              }),
            ),
            const SizedBox(height: 24),

            // ── 저장 위치 ──
            _SectionCard(
              label: '어디에 남길까요?',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _DestinationButton(
                    selected: _destination == _RequestDestination.personal,
                    icon: Icons.edit_note_rounded,
                    title: '내 스터디',
                    subtitle: '혼자 쓰는 노트와 연습장에 저장',
                    onTap: isLoading
                        ? null
                        : () => setState(() {
                            _destination = _RequestDestination.personal;
                            _selectedFriendId = '';
                          }),
                  ),
                  const SizedBox(height: 8),
                  _DestinationButton(
                    selected: _destination == _RequestDestination.friend,
                    icon: Icons.people_rounded,
                    title: '친구 스터디',
                    subtitle: '친구와 함께 보는 스터디 카드로 저장',
                    onTap: isLoading
                        ? null
                        : () => setState(
                            () => _destination = _RequestDestination.friend,
                          ),
                  ),
                  const SizedBox(height: 8),
                  _DestinationButton(
                    selected: _destination == _RequestDestination.community,
                    icon: Icons.forum_rounded,
                    title: '커뮤니티',
                    subtitle: '공개 게시판에 첨삭 요청으로 올리기',
                    onTap: isLoading
                        ? null
                        : () => setState(() {
                            _destination = _RequestDestination.community;
                            _selectedFriendId = '';
                          }),
                  ),
                  if (_destination == _RequestDestination.friend) ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedFriendId.isEmpty
                          ? null
                          : _selectedFriendId,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        labelText: '친구 선택',
                      ),
                      items: friends
                          .map(
                            (Friend friend) => DropdownMenuItem<String>(
                              value: friend.id,
                              child: Text(friend.username),
                            ),
                          )
                          .toList(),
                      onChanged: isLoading
                          ? null
                          : (value) =>
                                setState(() => _selectedFriendId = value ?? ''),
                    ),
                    if (friendsAsync.isLoading)
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: LinearProgressIndicator(),
                      ),
                    if (!friendsAsync.isLoading && friends.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          '친구 탭에서 먼저 친구를 추가해 주세요.',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── 언어 선택 ──
            if (_destination == _RequestDestination.community) ...[
              _SectionCard(
                label: strings.correctionLanguage,
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
            ],

            // ── 내용 ──
            if (!_isAudio) ...[
              _SectionCard(
                label: strings.requestContentLabel,
                child: Column(
                  children: [
                    TextFormField(
                      controller: _textController,
                      minLines: 4,
                      maxLines: 8,
                      maxLength: 1000,
                      decoration: InputDecoration(
                        border: const OutlineInputBorder(),
                        hintText: strings.requestContentPlaceholder,
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? strings.requestContentRequired
                          : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _contextController,
                      maxLines: 2,
                      decoration: InputDecoration(
                        border: const OutlineInputBorder(),
                        hintText: strings.requestTextContextHint,
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              _SectionCard(
                label: strings.audioRecording,
                child: Column(
                  children: [
                    _AudioRecorderWidget(
                      recorder: _recorder,
                      onStart: _startRecording,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _contextController,
                      maxLines: 2,
                      decoration: InputDecoration(
                        border: const OutlineInputBorder(),
                        hintText: strings.requestAudioContextHint,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),

            // ── 피드백 목표 ──
            _SectionCard(
              label: strings.feedbackGoalOptional,
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
            _CreditBanner(
              isAudio: _isAudio,
              isCommunity: _destination == _RequestDestination.community,
            ),
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
                  : Text(
                      _destination == _RequestDestination.community
                          ? strings.submitCorrectionRequest
                          : '스터디에 저장',
                    ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  bool get _canSubmit {
    if (_destination == _RequestDestination.community &&
        _targetLanguage.isEmpty) {
      return false;
    }
    if (_destination == _RequestDestination.friend &&
        _selectedFriendId.isEmpty) {
      return false;
    }
    if (_isAudio) return _recorder.state == RecorderState.stopped;
    return _textController.text.trim().isNotEmpty;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_destination == _RequestDestination.community) {
      await _submitCommunityRequest();
      return;
    }

    await _submitStudyCard();
  }

  Future<void> _submitCommunityRequest() async {
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
          final strings = ref.read(tProvider);
          _showError(strings.requestSubmitFailed(_friendlyError(e)));
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

  Future<void> _submitStudyCard() async {
    setState(() => _submittingStudy = true);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    final phrase = _studyPhrase();

    StudySession? session;

    try {
      final repo = ref.read(studySessionRepositoryProvider);
      final sessions = await ref.read(studySessionListStateProvider.future);
      session = await _ensureStudySession(sessions);
      final card = await repo.createCard(
        sessionId: session.id,
        phrase: phrase,
        context: _contextController.text.trim().isEmpty
            ? null
            : _contextController.text.trim(),
        tags: List.from(_feedbackGoals),
      );

      if (_isAudio) {
        try {
          await _attachNativeAudio(repo, card.id);
        } on Exception {
          await _deleteCreatedCard(repo, card.id);
          rethrow;
        }
      }

      ref.invalidate(studySessionListStateProvider);
      ref.invalidate(sessionCardsProvider(session.id));

      if (!mounted) return;
      messenger.showSnackBar(const SnackBar(content: Text('스터디에 저장했어요.')));
      router.go(AppRoute.cardDetail(session.id, card.id));
    } on Exception catch (e) {
      if (!mounted) return;
      _showError('스터디 저장에 실패했어요. ${_friendlyError(e)}');
    } finally {
      if (mounted) setState(() => _submittingStudy = false);
    }
  }

  String _studyPhrase() {
    if (!_isAudio) return _textController.text.trim();
    final context = _contextController.text.trim();
    if (context.isNotEmpty) return context;
    final now = DateTime.now();
    return '음성 카드 ${now.month}/${now.day} ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
  }

  Future<StudySession> _ensureStudySession(List<StudySession> sessions) async {
    final active = sessions.where((session) => session.status == 'ACTIVE');
    if (_destination == _RequestDestination.personal) {
      final existing = active
          .where((session) => session.memberIds.length == 1)
          .firstOrNull;
      if (existing != null) return existing;
      return ref
          .read(studySessionListStateProvider.notifier)
          .createSession(null, title: '내 연습장');
    }

    final friendId = _selectedFriendId;
    final existing = active
        .where(
          (session) =>
              session.memberIds.length > 1 &&
              session.memberIds.contains(friendId),
        )
        .firstOrNull;
    if (existing != null) return existing;

    final friends = ref.read(friendListStateProvider).value ?? const <Friend>[];
    final friend = friends
        .where((Friend item) => item.id == friendId)
        .firstOrNull;
    return ref
        .read(studySessionListStateProvider.notifier)
        .createSession(
          friendId,
          title: friend == null ? null : '${friend.username} 연습장',
        );
  }

  Future<void> _attachNativeAudio(
    StudySessionRepository repo,
    String cardId,
  ) async {
    final hasRecording = kIsWeb
        ? _recorder.webBlobUrl != null
        : _recorder.file != null;
    if (!hasRecording) throw Exception('녹음 파일이 없어요.');

    const ext = kIsWeb ? 'webm' : 'm4a';
    final fileName =
        'study_audio_${DateTime.now().millisecondsSinceEpoch}.$ext';
    final urls = await repo.getNativeAudioUploadUrlV2(cardId, fileName);
    final uploadUrl = urls['uploadUrl'];
    final audioKey = urls['audioKey'];
    if (uploadUrl == null || audioKey == null) {
      throw const FormatException(
        'presigned URL response missing required keys',
      );
    }

    final uploader = PresignedUploadService(dio: ref.read(dioProvider));
    if (kIsWeb) {
      await uploader.uploadBytesToUrl(
        bytes: await _recorder.getWebBytes(),
        uploadUrl: uploadUrl,
      );
    } else {
      await uploader.uploadToUrl(
        file: _recorder.file!,
        uploadUrl: uploadUrl,
        contentType: PresignedUploadService.contentTypeForFileName(fileName),
      );
    }

    await repo.confirmNativeAudioV2(cardId, audioKey);
  }

  Future<void> _deleteCreatedCard(
    StudySessionRepository repo,
    String cardId,
  ) async {
    try {
      await repo.deleteCard(cardId);
    } on Exception {
      // Best-effort cleanup: surface the original upload error to the user.
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
    final strings = ref.read(tProvider);
    if (text.contains('401') || text.contains('403')) return strings.loginAgain;
    if (text.contains('400')) return strings.checkRequestContent;
    if (text.toLowerCase().contains('timeout')) {
      return strings.checkNetwork;
    }
    return strings.genericError;
  }
}

// ── Sub-widgets ─────────────────────────────────────────────────────────────

class _DestinationButton extends StatelessWidget {
  const _DestinationButton({
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final bool selected;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.all(14),
        side: BorderSide(
          color: selected
              ? theme.colorScheme.primary
              : theme.colorScheme.outlineVariant,
        ),
        backgroundColor: selected
            ? theme.colorScheme.primaryContainer.withValues(alpha: 0.36)
            : theme.colorScheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Row(
        children: [
          Icon(
            icon,
            color: selected
                ? theme.colorScheme.primary
                : theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          if (selected)
            Icon(Icons.check_circle_rounded, color: theme.colorScheme.primary),
        ],
      ),
    );
  }
}

class _SegmentRow extends ConsumerWidget {
  const _SegmentRow({required this.isAudio, required this.onChanged});
  final bool isAudio;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = ref.watch(tProvider);
    return SegmentedButton<bool>(
      segments: [
        ButtonSegment(
          value: false,
          icon: const Icon(Icons.text_fields_rounded),
          label: Text(strings.text),
        ),
        ButtonSegment(
          value: true,
          icon: const Icon(Icons.mic_rounded),
          label: Text(strings.audio),
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

class _CreditBanner extends ConsumerWidget {
  const _CreditBanner({required this.isAudio, required this.isCommunity});
  final bool isAudio;
  final bool isCommunity;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final strings = ref.watch(tProvider);
    final cost = isCommunity
        ? (isAudio ? AppConfig.audioRequestCost : AppConfig.textRequestCost)
        : 0;
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
            strings.creditCost(cost),
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
  const _AudioRecorderWidget({required this.recorder, required this.onStart});

  final AudioRecorderService recorder;
  final Future<void> Function() onStart;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return switch (recorder.state) {
      RecorderState.idle => _OpenRecordSheetButton(
        onTap: () => _showRecorderSheet(context),
        theme: theme,
      ),
      RecorderState.recording => _RecordingIndicator(
        duration: recorder.formattedDuration,
        onStop: () => recorder.stop(),
        theme: theme,
      ),
      RecorderState.stopped => _RecordingStopped(
        recorder: recorder,
        theme: theme,
      ),
    };
  }

  void _showRecorderSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      isDismissible: recorder.state != RecorderState.recording,
      builder: (_) => _RecorderSheet(recorder: recorder, onStart: onStart),
    );
  }
}

class _OpenRecordSheetButton extends StatelessWidget {
  const _OpenRecordSheetButton({required this.onTap, required this.theme});
  final VoidCallback onTap;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    final strings = ProviderScope.containerOf(context).read(tProvider);
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: onTap,
        icon: const Icon(Icons.mic_rounded),
        label: Text(strings.recordAction),
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 16),
          backgroundColor: theme.colorScheme.error,
          foregroundColor: theme.colorScheme.onError,
        ),
      ),
    );
  }
}

class _RecorderSheet extends StatefulWidget {
  const _RecorderSheet({required this.recorder, required this.onStart});

  final AudioRecorderService recorder;
  final Future<void> Function() onStart;

  @override
  State<_RecorderSheet> createState() => _RecorderSheetState();
}

class _RecorderSheetState extends State<_RecorderSheet> {
  @override
  void initState() {
    super.initState();
    widget.recorder.addListener(_onChange);
  }

  @override
  void dispose() {
    widget.recorder.removeListener(_onChange);
    super.dispose();
  }

  void _onChange() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final strings = ProviderScope.containerOf(context).read(tProvider);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                strings.audioRecording,
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              if (widget.recorder.state != RecorderState.recording)
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                ),
            ],
          ),
          const SizedBox(height: 20),
          switch (widget.recorder.state) {
            RecorderState.idle => _RecordButton(
              onTap: widget.onStart,
              theme: theme,
            ),
            RecorderState.recording => _RecordingIndicator(
              duration: widget.recorder.formattedDuration,
              onStop: () => widget.recorder.stop(),
              theme: theme,
            ),
            RecorderState.stopped => _RecordingStopped(
              recorder: widget.recorder,
              theme: theme,
            ),
          },
          if (widget.recorder.state == RecorderState.stopped) ...[
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: Text(strings.useRecording),
            ),
          ],
        ],
      ),
    );
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

class _RecordingIndicator extends ConsumerWidget {
  const _RecordingIndicator({
    required this.duration,
    required this.onStop,
    required this.theme,
  });
  final String duration;
  final VoidCallback onStop;
  final ThemeData theme;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = ref.watch(tProvider);
    return Column(
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
              strings.recording,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _RecordingStopped extends StatefulWidget {
  const _RecordingStopped({required this.recorder, required this.theme});
  final AudioRecorderService recorder;
  final ThemeData theme;

  @override
  State<_RecordingStopped> createState() => _RecordingStoppedState();
}

class _RecordingStoppedState extends State<_RecordingStopped> {
  late final AudioPlayer _player;
  bool _sourceReady = false;

  @override
  void initState() {
    super.initState();
    _player = AudioPlayer();
    _prepare();
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _prepare() async {
    try {
      if (kIsWeb) {
        final url = widget.recorder.webBlobUrl;
        if (url == null) return;
        await _player.setUrl(url);
      } else {
        final path = widget.recorder.file?.path;
        if (path == null) return;
        await _player.setFilePath(path);
      }
      if (mounted) setState(() => _sourceReady = true);
    } on Exception {
      if (mounted) setState(() => _sourceReady = false);
    }
  }

  Future<void> _toggle() async {
    if (!_sourceReady) return;
    if (_player.playing) {
      await _player.pause();
    } else {
      if (_player.position >= (_player.duration ?? widget.recorder.duration)) {
        await _player.seek(Duration.zero);
      }
      await _player.play();
    }
    if (mounted) setState(() {});
  }

  Future<void> _seek(double fraction) async {
    final total = _player.duration ?? widget.recorder.duration;
    if (total == Duration.zero) return;
    await _player.seek(total * fraction.clamp(0.0, 1.0));
  }

  @override
  Widget build(BuildContext context) {
    final theme = widget.theme;
    final strings = ProviderScope.containerOf(context).read(tProvider);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.secondaryContainer.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          StreamBuilder<Duration>(
            stream: _player.positionStream,
            initialData: Duration.zero,
            builder: (context, positionSnapshot) {
              final position = positionSnapshot.data ?? Duration.zero;
              final total = _player.duration ?? widget.recorder.duration;
              final fraction = total.inMilliseconds <= 0
                  ? 0.0
                  : position.inMilliseconds / total.inMilliseconds;
              return Column(
                children: [
                  Row(
                    children: [
                      IconButton.filled(
                        icon: Icon(
                          _player.playing
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                        ),
                        onPressed: _sourceReady ? _toggle : null,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: LayoutBuilder(
                          builder: (context, constraints) => GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTapDown: (details) {
                              _seek(
                                details.localPosition.dx / constraints.maxWidth,
                              );
                            },
                            onHorizontalDragUpdate: (details) {
                              _seek(
                                details.localPosition.dx / constraints.maxWidth,
                              );
                            },
                            child: SizedBox(
                              height: 56,
                              child: CustomPaint(
                                painter: _WaveformPainter(
                                  progress: fraction.clamp(0.0, 1.0),
                                  activeColor: theme.colorScheme.primary,
                                  inactiveColor: theme
                                      .colorScheme
                                      .onSecondaryContainer
                                      .withValues(alpha: 0.24),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Text(
                        _format(position),
                        style: theme.textTheme.labelMedium,
                      ),
                      const Spacer(),
                      Text(
                        _format(total),
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: theme.colorScheme.outline,
                        ),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    _player.stop();
                    widget.recorder.reset();
                  },
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: Text(strings.recordAgain),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _format(Duration duration) {
    final minutes = duration.inMinutes.toString().padLeft(2, '0');
    final seconds = (duration.inSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }
}

class _WaveformPainter extends CustomPainter {
  const _WaveformPainter({
    required this.progress,
    required this.activeColor,
    required this.inactiveColor,
  });

  final double progress;
  final Color activeColor;
  final Color inactiveColor;

  @override
  void paint(Canvas canvas, Size size) {
    const barWidth = 3.0;
    const gap = 3.0;
    final count = math.max(1, (size.width / (barWidth + gap)).floor());
    final activeUntil = count * progress;
    final centerY = size.height / 2;

    for (int i = 0; i < count; i++) {
      final t = i / count;
      final wave = 0.38 + 0.52 * math.sin(t * math.pi * 8).abs();
      final accent = 0.72 + 0.28 * math.sin((i * 19) % 31).abs();
      final height = math.max(8.0, size.height * wave * accent);
      final x = i * (barWidth + gap);
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, centerY - height / 2, barWidth, height),
        const Radius.circular(4),
      );
      canvas.drawRRect(
        rect,
        Paint()..color = i <= activeUntil ? activeColor : inactiveColor,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _WaveformPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.activeColor != activeColor ||
      oldDelegate.inactiveColor != inactiveColor;
}
