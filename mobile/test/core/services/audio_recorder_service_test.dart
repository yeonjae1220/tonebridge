import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_sound/flutter_sound.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:permission_handler_platform_interface/permission_handler_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:tonebridge/core/services/audio_recorder_service.dart';

// ── Minimal permission_handler fake ─────────────────────────────────────────

class _FakePermissionHandlerPlatform extends Fake
    with MockPlatformInterfaceMixin
    implements PermissionHandlerPlatform {
  PermissionStatus micStatus;

  _FakePermissionHandlerPlatform({this.micStatus = PermissionStatus.granted});

  @override
  Future<PermissionStatus> checkPermissionStatus(Permission permission) async =>
      micStatus;

  @override
  Future<Map<Permission, PermissionStatus>> requestPermissions(
      List<Permission> permissions) async {
    return {for (final p in permissions) p: micStatus};
  }

  @override
  Future<bool> shouldShowRequestPermissionRationale(
          Permission permission) async =>
      false;

  @override
  Future<bool> openAppSettings() async => true;
}

// ── Fake SoundRecorder ───────────────────────────────────────────────────────

class _FakeRecorder implements SoundRecorder {
  int openCount = 0;
  int startCount = 0;
  int stopCount = 0;
  int closeCount = 0;
  String? lastToFile;

  @override
  Future<void> openRecorder() async => openCount++;

  @override
  Future<void> startRecorder({
    String? toFile,
    Codec codec = Codec.defaultCodec,
  }) async {
    lastToFile = toFile;
    startCount++;
  }

  @override
  Future<void> stopRecorder() async => stopCount++;

  @override
  Future<void> closeRecorder() async => closeCount++;
}

const _pathProviderChannel = MethodChannel('plugins.flutter.io/path_provider');

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _FakeRecorder fakeRecorder;

  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_pathProviderChannel, (call) async {
      if (call.method == 'getTemporaryDirectory') {
        return Directory.systemTemp.path;
      }
      return null;
    });
  });

  setUp(() {
    fakeRecorder = _FakeRecorder();
    PermissionHandlerPlatform.instance = _FakePermissionHandlerPlatform(
      micStatus: PermissionStatus.granted,
    );
  });

  AudioRecorderService makeSvc() =>
      AudioRecorderService(recorder: fakeRecorder);

  group('AudioRecorderService — initial state', () {
    test('starts in idle state', () {
      final svc = makeSvc();
      expect(svc.state, RecorderState.idle);
      expect(svc.filePath, isNull);
      expect(svc.file, isNull);
      svc.dispose();
    });

    test('formattedDuration is "00:00" initially', () {
      final svc = makeSvc();
      expect(svc.formattedDuration, '00:00');
      svc.dispose();
    });
  });

  group('AudioRecorderService — permission denied (H-3)', () {
    setUp(() {
      PermissionHandlerPlatform.instance = _FakePermissionHandlerPlatform(
        micStatus: PermissionStatus.denied,
      );
    });

    test('start() throws when microphone permission is denied', () async {
      final svc = makeSvc();
      await expectLater(
        svc.start(),
        throwsA(isA<Exception>().having(
          (e) => e.toString(),
          'message',
          contains('마이크 권한'),
        )),
      );
      expect(svc.state, RecorderState.idle);
      svc.dispose();
    });

    test('state stays idle and notifyListeners is not called on denial',
        () async {
      final svc = makeSvc();
      var notified = false;
      svc.addListener(() => notified = true);

      try {
        await svc.start();
      } on Exception {
        // expected
      }

      expect(notified, isFalse);
      svc.dispose();
    });
  });

  group('AudioRecorderService — normal flow (H-7)', () {
    test('start() transitions to recording and notifies listeners', () async {
      final svc = makeSvc();
      var notified = false;
      svc.addListener(() => notified = true);

      await svc.start();

      expect(svc.state, RecorderState.recording);
      expect(svc.filePath, isNotNull);
      expect(notified, isTrue);
      svc.dispose();
    });

    test('stop() transitions to stopped', () async {
      final svc = makeSvc();
      await svc.start();
      await svc.stop();

      expect(svc.state, RecorderState.stopped);
      svc.dispose();
    });

    test('stop() is a no-op when not recording', () async {
      final svc = makeSvc();
      await svc.stop();
      expect(svc.state, RecorderState.idle);
      svc.dispose();
    });

    test('reset() returns to idle and clears filePath', () async {
      final svc = makeSvc();
      await svc.start();
      await svc.stop();

      final path = svc.filePath!;
      File(path).createSync(recursive: true);

      svc.reset();

      expect(svc.state, RecorderState.idle);
      expect(svc.filePath, isNull);
      expect(File(path).existsSync(), isFalse);
    });

    test('dispose() does not throw when idle', () {
      final svc = makeSvc();
      expect(svc.dispose, returnsNormally);
    });

    test('dispose() calls stopRecorder before closeRecorder when recording (H-7)',
        () async {
      final svc = makeSvc();
      await svc.start();
      svc.dispose();

      // Give unawaited futures a chance to run
      await Future<void>.delayed(Duration.zero);

      expect(fakeRecorder.stopCount, 1);
      expect(fakeRecorder.closeCount, 1);
    });

    test('dispose() calls only closeRecorder when idle (H-7)', () async {
      final svc = makeSvc();
      svc.dispose();
      await Future<void>.delayed(Duration.zero);

      expect(fakeRecorder.stopCount, 0);
      expect(fakeRecorder.closeCount, 1);
    });

    test('start() is idempotent — second call while recording is no-op',
        () async {
      final svc = makeSvc();
      await svc.start();
      final firstPath = svc.filePath;

      await svc.start(); // second call should be ignored

      expect(svc.filePath, equals(firstPath));
      expect(fakeRecorder.startCount, 1); // only called once
      svc.dispose();
    });

    test('openRecorder() called once across multiple starts (lazy init)',
        () async {
      final svc = makeSvc();
      await svc.start();
      await svc.stop();
      svc.reset();
      await svc.start();

      expect(fakeRecorder.openCount, 1);
      svc.dispose();
    });
  });
}
