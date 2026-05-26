import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

enum RecorderState { idle, recording, stopped }

class RecorderPermissionException implements Exception {
  const RecorderPermissionException();

  @override
  String toString() => '마이크 권한이 필요합니다.';
}

class AudioRecorderService extends ChangeNotifier {
  final _recorder = AudioRecorder();

  RecorderState _state = RecorderState.idle;
  String? _nativePath;
  String? _webBlobUrl;
  Duration _duration = Duration.zero;
  Timer? _timer;

  RecorderState get state => _state;
  Duration get duration => _duration;

  // Native: File reference; null on web
  File? get file =>
      (!kIsWeb && _nativePath != null) ? File(_nativePath!) : null;

  // Web: blob URL returned by stop(); null on native
  String? get webBlobUrl => kIsWeb ? _webBlobUrl : null;

  Future<void> start() async {
    if (_state == RecorderState.recording) return;

    final hasPermission = await _recorder.hasPermission();
    if (!hasPermission) throw const RecorderPermissionException();

    final String path;
    if (kIsWeb) {
      path = '';
    } else {
      final dir = await getTemporaryDirectory();
      path =
          '${dir.path}/tonebridge_rec_${DateTime.now().millisecondsSinceEpoch}.m4a';
    }

    // opus(webm) — Chrome/Firefox 지원. aacLc는 Chrome MediaRecorder 미지원.
    await _recorder.start(
      RecordConfig(encoder: kIsWeb ? AudioEncoder.opus : AudioEncoder.aacLc),
      path: path,
    );

    _nativePath = kIsWeb ? null : path;
    _webBlobUrl = null;
    _duration = Duration.zero;
    _state = RecorderState.recording;

    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      _duration += const Duration(seconds: 1);
      notifyListeners();
    });
    notifyListeners();
  }

  Future<void> stop() async {
    if (_state != RecorderState.recording) return;
    _timer?.cancel();

    final result = await _recorder.stop();
    if (kIsWeb) {
      _webBlobUrl = result;
    } else {
      _nativePath = result;
    }

    _state = RecorderState.stopped;
    notifyListeners();
  }

  void reset() {
    _timer?.cancel();
    if (!kIsWeb && _nativePath != null) {
      final f = File(_nativePath!);
      if (f.existsSync()) f.deleteSync();
    }
    _nativePath = null;
    _webBlobUrl = null;
    _duration = Duration.zero;
    _state = RecorderState.idle;
    notifyListeners();
  }

  // Fetches recorded bytes from the web blob URL.
  // Throws [StateError] if called on native or before recording is stopped.
  Future<Uint8List> getWebBytes() async {
    if (!kIsWeb || _webBlobUrl == null) {
      throw StateError('getWebBytes() requires a completed web recording');
    }
    final response = await http.get(Uri.parse(_webBlobUrl!));
    if (response.statusCode != 200) {
      throw Exception('Blob URL fetch failed: ${response.statusCode}');
    }
    return response.bodyBytes;
  }

  String get formattedDuration {
    final m = _duration.inMinutes.toString().padLeft(2, '0');
    final s = (_duration.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  void dispose() {
    _timer?.cancel();
    unawaited(_recorder.dispose());
    super.dispose();
  }
}
