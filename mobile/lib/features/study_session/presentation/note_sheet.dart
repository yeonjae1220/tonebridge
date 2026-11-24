import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/features/study_session/domain/sound_guides.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';

class NoteSheet extends ConsumerStatefulWidget {
  const NoteSheet({
    required this.attemptId,
    required this.onNoteAdded,
    this.initialNote,
    this.initialScore,
    this.initialSoundGuideIds = const [],
    super.key,
  });
  final String attemptId;
  final VoidCallback onNoteAdded;

  /// Existing feedback to edit; null when writing new feedback.
  final String? initialNote;
  final int? initialScore;
  final List<String> initialSoundGuideIds;

  bool get isEditing => initialNote != null;

  @override
  ConsumerState<NoteSheet> createState() => _NoteSheetState();
}

class _NoteSheetState extends ConsumerState<NoteSheet> {
  late final _noteController = TextEditingController(text: widget.initialNote);
  late int? _selectedScore = widget.initialScore;
  // Ids no longer in the catalogue would be rejected by the server, so they are dropped.
  late final List<String> _soundGuideIds = [
    for (final id in widget.initialSoundGuideIds)
      if (soundGuides.any((guide) => guide.id == id)) id,
  ].take(maxFeedbackSounds).toList();
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
          .addNote(
            widget.attemptId,
            note,
            _selectedScore,
            soundGuideIds: List.unmodifiable(_soundGuideIds),
          );
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
    final savingNote = ref.watch(cardAttemptStateProvider).isLoading;
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
            Text(
              widget.isEditing ? '교정 메모 수정' : '교정 메모 추가',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
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
            _SoundPicker(
              selected: _soundGuideIds,
              enabled: !_submitting,
              onToggle: (id) => setState(
                () => _soundGuideIds.contains(id)
                    ? _soundGuideIds.remove(id)
                    : _soundGuideIds.add(id),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submitting || savingNote ? null : _submit,
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

/// Up to [maxFeedbackSounds] pronunciation guides the feedback points at; same limit as the server.
class _SoundPicker extends StatelessWidget {
  const _SoundPicker({
    required this.selected,
    required this.enabled,
    required this.onToggle,
  });

  final List<String> selected;
  final bool enabled;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final full = selected.length >= maxFeedbackSounds;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('짚을 소리 (선택)', style: theme.textTheme.labelLarge),
        const SizedBox(height: 4),
        Text(
          full ? '소리는 3개까지 고를 수 있어요.' : '고른 소리의 입 모양 그림이 피드백과 함께 보여요.',
          style: TextStyle(fontSize: 12, color: theme.colorScheme.outline),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final guide in soundGuides)
              FilterChip(
                label: Text(guide.title),
                selected: selected.contains(guide.id),
                // Removing is always allowed; adding stops at the limit.
                onSelected: enabled && (selected.contains(guide.id) || !full)
                    ? (_) => onToggle(guide.id)
                    : null,
              ),
          ],
        ),
      ],
    );
  }
}
