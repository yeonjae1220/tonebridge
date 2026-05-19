import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_sound/flutter_sound.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

enum RecorderState { idle, recording, stopped }

/// Narrow interface over [FlutterSoundRecorder] — used for injection in tests.
abstract interface class SoundRecorder {
  Future<void> openRecorder();
  Future<void> startRecorder({String? toFile, Codec codec});
  Future<void> stopRecorder();
  Future<void> closeRecorder();
}

/// Production adapter wrapping [FlutterSoundRecorder].
class _FlutterSoundAdapter implements SoundRecorder {
  final _inner = FlutterSoundRecorder();

  @override
  Future<void> openRecorder() => _inner.openRecorder();

  @override
  Future<void> startRecorder({String? toFile, Codec codec = Codec.defaultCodec}) =>
      _inner.startRecorder(toFile: toFile, codec: codec);

  @override
  Future<void> stopRecorder() => _inner.stopRecorder();

  @override
  Future<void> closeRecorder() => _inner.closeRecorder();
}

class AudioRecorderService extends ChangeNotifier {
  AudioRecorderService({SoundRecorder? recorder})
      : _recorder = recorder ?? _FlutterSoundAdapter();

  final SoundRecorder _recorder;

  RecorderState _state = RecorderState.idle;
  String? _filePath;
  Duration _duration = Duration.zero;
  Timer? _timer;
  bool _initialized = false;

  RecorderState get state => _state;
  String? get filePath => _filePath;
  Duration get duration => _duration;

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    await _recorder.openRecorder();
    _initialized = true;
  }

  Future<bool> _requestPermission() async {
    final status = await Permission.microphone.request();
    return status.isGranted;
  }

  Future<void> start() async {
    if (_state == RecorderState.recording) return;

    final granted = await _requestPermission();
    if (!granted) {
      // Surface as an exception so the caller can show an appropriate error.
      throw Exception('마이크 권한이 필요합니다. 설정에서 권한을 허용해주세요.');
    }

    await _ensureInitialized();

    final dir = await getTemporaryDirectory();
    _filePath =
        '${dir.path}/tonebridge_rec_${DateTime.now().millisecondsSinceEpoch}.aac';
    _duration = Duration.zero;

    await _recorder.startRecorder(
      toFile: _filePath,
      codec: Codec.aacADTS,
    );

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
    await _recorder.stopRecorder();
    _state = RecorderState.stopped;
    notifyListeners();
  }

  void reset() {
    _timer?.cancel();
    if (_filePath != null) {
      final f = File(_filePath!);
      if (f.existsSync()) f.deleteSync();
    }
    _filePath = null;
    _duration = Duration.zero;
    _state = RecorderState.idle;
    notifyListeners();
  }

  File? get file => _filePath != null ? File(_filePath!) : null;

  String get formattedDuration {
    final m = _duration.inMinutes.toString().padLeft(2, '0');
    final s = (_duration.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  void dispose() {
    _timer?.cancel();
    // Stop recorder if still active before closing to avoid native resource leak.
    if (_state == RecorderState.recording) {
      unawaited(_recorder.stopRecorder().then((_) => _recorder.closeRecorder()));
    } else {
      unawaited(_recorder.closeRecorder());
    }
    super.dispose();
  }
}
