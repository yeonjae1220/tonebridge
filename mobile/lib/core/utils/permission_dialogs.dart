import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:tonebridge/core/services/audio_recorder_service.dart';

void showMicPermissionError(
    BuildContext context, RecorderPermissionException e) {
  if (e.isPermanentlyDenied) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('마이크 권한 필요'),
        content: const Text('앱 설정에서 마이크 권한을 허용해야 녹음할 수 있어요.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              openAppSettings();
            },
            child: const Text('설정으로 이동'),
          ),
        ],
      ),
    );
  } else {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('마이크 권한이 필요해요')),
    );
  }
}
