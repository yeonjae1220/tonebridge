import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';

class NoteSheet extends ConsumerStatefulWidget {
  const NoteSheet({
    super.key,
    required this.attemptId,
    required this.onNoteAdded,
  });
  final String attemptId;
  final VoidCallback onNoteAdded;

  @override
  ConsumerState<NoteSheet> createState() => _NoteSheetState();
}

class _NoteSheetState extends ConsumerState<NoteSheet> {
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
