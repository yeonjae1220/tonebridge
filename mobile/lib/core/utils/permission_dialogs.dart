import 'package:flutter/material.dart';
import 'package:tonebridge/core/services/audio_recorder_service.dart';

void showMicPermissionError(
    BuildContext context, RecorderPermissionException e) {
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('마이크 권한이 필요해요. 브라우저 또는 앱 설정에서 허용해 주세요.')),
  );
}
