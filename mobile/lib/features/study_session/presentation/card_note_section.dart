import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/features/study_session/data/study_session_repository_impl.dart';
import 'package:tonebridge/features/study_session/domain/model/study_card.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';

class CardNoteSection extends ConsumerStatefulWidget {
  const CardNoteSection({required this.card, this.onSaved, super.key});
  final StudyCard card;
  final VoidCallback? onSaved;

  @override
  ConsumerState<CardNoteSection> createState() => _CardNoteSectionState();
}

class _CardNoteSectionState extends ConsumerState<CardNoteSection> {
  bool _saving = false;

  Future<void> _openEditor() async {
    final controller = TextEditingController(text: widget.card.note ?? '');
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _NoteEditorSheet(controller: controller),
    );
    if (result == null || !mounted) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(studySessionRepositoryProvider)
          .updateCardNote(widget.card.id, result.isEmpty ? null : result);
      if (mounted) {
        widget.onSaved?.call();
        ref.invalidate(cardDetailProvider(widget.card.id));
      }
    } on Exception catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('메모 저장에 실패했어요. 다시 시도해 주세요.')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasNote = widget.card.note != null && widget.card.note!.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.sticky_note_2_outlined,
                size: 18,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(width: 8),
              const Text(
                '공유 메모',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              if (_saving)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                IconButton(
                  icon: Icon(hasNote ? Icons.edit_outlined : Icons.add_rounded),
                  iconSize: 20,
                  onPressed: _openEditor,
                  tooltip: hasNote ? '메모 수정' : '메모 추가',
                ),
            ],
          ),
          if (hasNote) ...[
            const SizedBox(height: 8),
            Text(
              widget.card.note!,
              style: TextStyle(
                fontSize: 14,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ] else
            Text(
              '세션 멤버 모두가 볼 수 있는 메모예요.',
              style: TextStyle(fontSize: 12, color: theme.colorScheme.outline),
            ),
        ],
      ),
    );
  }
}

class _NoteEditorSheet extends StatelessWidget {
  const _NoteEditorSheet({required this.controller});
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
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
          const Text(
            '공유 메모',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            '세션 멤버 모두가 볼 수 있어요.',
            style: TextStyle(
              fontSize: 13,
              color: Theme.of(context).colorScheme.outline,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: controller,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: '발음 팁, 사용 예시 등을 남겨보세요',
              border: OutlineInputBorder(),
            ),
            maxLines: 4,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.pop(context, controller.text),
              child: const Text('저장'),
            ),
          ),
        ],
      ),
    );
  }
}
