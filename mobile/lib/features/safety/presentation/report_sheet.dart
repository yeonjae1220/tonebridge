import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/features/safety/data/safety_repository_impl.dart';
import 'package:tonebridge/features/safety/domain/safety_repository.dart';
import 'package:tonebridge/features/safety/presentation/safety_actions.dart';
import 'package:tonebridge/features/safety/presentation/safety_strings.dart';

class ReportOutcome {
  const ReportOutcome({required this.blocked});
  final bool blocked;
}

class ReportSheet extends ConsumerStatefulWidget {
  const ReportSheet({
    required this.target,
    required this.targetId,
    this.authorName,
    super.key,
  });

  final ReportTarget target;
  final String targetId;

  /// Shown in the "also block" option; null when the client doesn't know it.
  final String? authorName;

  @override
  ConsumerState<ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends ConsumerState<ReportSheet> {
  final _detail = TextEditingController();
  ReportReason? _reason;
  bool _alsoBlock = false;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _detail.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final reason = _reason;
    if (reason == null || _sending) return;
    final strings = ref.read(tProvider);
    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref
          .read(safetyRepositoryProvider)
          .report(
            target: widget.target,
            targetId: widget.targetId,
            reason: reason,
            detail: _detail.text,
            alsoBlock: _alsoBlock,
          );
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(strings.reportSent)));
      Navigator.of(context).pop(ReportOutcome(blocked: _alsoBlock));
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = reportErrorMessage(e, strings);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = ref.watch(tProvider);
    final theme = Theme.of(context);
    final author = widget.authorName;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.target == ReportTarget.user
                  ? strings.reportUser
                  : strings.reportContent,
              style: theme.textTheme.titleLarge,
            ),
            const SizedBox(height: 4),
            Text(strings.reportReasonPrompt),
            const SizedBox(height: 8),
            RadioGroup<ReportReason>(
              groupValue: _reason,
              onChanged: (value) => setState(() => _reason = value),
              child: Column(
                children: [
                  for (final reason in ReportReason.values)
                    RadioListTile<ReportReason>(
                      key: ValueKey('report-reason-${reason.name}'),
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      value: reason,
                      enabled: !_sending,
                      title: Text(strings.reportReason(reason)),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _detail,
              enabled: !_sending,
              maxLength: reportDetailMaxLength,
              maxLines: 3,
              minLines: 1,
              decoration: InputDecoration(
                labelText: strings.reportDetailHint,
                border: const OutlineInputBorder(),
              ),
            ),
            CheckboxListTile(
              key: const ValueKey('report-also-block'),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              value: _alsoBlock,
              onChanged: _sending
                  ? null
                  : (value) => setState(() => _alsoBlock = value ?? false),
              title: Text(
                author == null ? strings.alsoBlockAuthor : strings.alsoBlock(author),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  _error!,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                key: const ValueKey('report-submit'),
                onPressed: _reason == null || _sending ? null : _submit,
                child: _sending
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(strings.sendReport),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
