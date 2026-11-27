import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/features/friend/presentation/friend_provider.dart';
import 'package:tonebridge/features/safety/data/safety_repository_impl.dart';
import 'package:tonebridge/features/safety/domain/safety_repository.dart';
import 'package:tonebridge/features/safety/presentation/blocked_users_provider.dart';
import 'package:tonebridge/features/safety/presentation/report_sheet.dart';
import 'package:tonebridge/features/safety/presentation/safety_strings.dart';
import 'package:tonebridge/features/study_session/presentation/study_provider.dart';

/// Blocking removes friendships, pending requests and shared-notebook
/// membership on the server, so every list built from those must reload.
void refreshAfterBlock(WidgetRef ref) {
  ref.invalidate(friendListStateProvider);
  ref.invalidate(pendingFriendRequestsProvider);
  ref.invalidate(studySessionListStateProvider);
  ref.invalidate(blockedUsersProvider);
}

/// Opens the report sheet. Returns true when the reporter also blocked the
/// author, so the caller can leave a screen they no longer have access to.
Future<bool> showReportSheet(
  BuildContext context,
  WidgetRef ref, {
  required ReportTarget target,
  required String targetId,
  String? authorName,
}) async {
  final outcome = await showModalBottomSheet<ReportOutcome>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    // Above the shell's tab bar, so the bar can't be tapped mid-report.
    useRootNavigator: true,
    builder: (_) => ReportSheet(
      target: target,
      targetId: targetId,
      authorName: authorName,
    ),
  );
  if (outcome == null) return false;
  if (outcome.blocked) refreshAfterBlock(ref);
  return outcome.blocked;
}

/// Asks for confirmation, then blocks [userId]. Returns true when blocked.
Future<bool> confirmAndBlock(
  BuildContext context,
  WidgetRef ref, {
  required String userId,
  String? username,
}) async {
  final strings = ref.read(tProvider);
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(
        username == null
            ? strings.blockConfirmTitleAuthor
            : strings.blockConfirmTitle(username),
      ),
      content: Text(strings.blockConfirmBody),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: Text(strings.cancel),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: Theme.of(ctx).colorScheme.error,
            foregroundColor: Theme.of(ctx).colorScheme.onError,
          ),
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(strings.block),
        ),
      ],
    ),
  );
  if (!(confirmed ?? false) || !context.mounted) return false;
  final messenger = ScaffoldMessenger.of(context);
  try {
    await ref.read(safetyRepositoryProvider).block(userId);
  } on Exception catch (_) {
    messenger.showSnackBar(SnackBar(content: Text(strings.genericError)));
    return false;
  }
  refreshAfterBlock(ref);
  messenger.showSnackBar(SnackBar(content: Text(strings.blockedDone)));
  return true;
}

/// Maps a report failure to a message; server codes come from backend
/// `ErrorCode.REPORT_*`.
String reportErrorMessage(Object error, ToneBridgeStrings strings) {
  if (error is DioException) {
    final data = error.response?.data;
    final code = data is Map ? data['code'] : null;
    switch (code) {
      case 'REPORT_001':
        return strings.reportTargetGone;
      case 'REPORT_002':
        return strings.reportOwnContent;
      case 'REPORT_003':
        return strings.reportLimitReached;
    }
  }
  return strings.genericError;
}
