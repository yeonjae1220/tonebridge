import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/core/services/presigned_upload_service.dart';

class _MockDio extends Mock implements Dio {}

class _FakeRequestOptions extends Fake implements RequestOptions {}

void main() {
  late _MockDio mockDio;
  late _MockDio mockUploadDio;
  late PresignedUploadService svc;
  late File tempFile;

  setUpAll(() {
    registerFallbackValue(_FakeRequestOptions());
  });

  setUp(() {
    mockDio = _MockDio();
    mockUploadDio = _MockDio();
    svc = PresignedUploadService(dio: mockDio, uploadDio: mockUploadDio);

    // S3 PUT always succeeds by default
    when(
      () => mockUploadDio.put<void>(
        any(),
        data: any(named: 'data'),
        options: any(named: 'options'),
      ),
    ).thenAnswer((_) async => Response<void>(
          statusCode: 200,
          requestOptions: RequestOptions(path: ''),
        ));

    final dir = Directory.systemTemp.createTempSync('tonebridge_test_');
    tempFile = File('${dir.path}/audio.aac')..writeAsBytesSync([1, 2, 3]);
  });

  tearDown(() {
    if (tempFile.existsSync()) tempFile.deleteSync();
    if (tempFile.parent.existsSync()) tempFile.parent.deleteSync();
  });

  group('PresignedUploadService.upload (H-4)', () {
    test('returns key on successful upload', () async {
      // Arrange: backend returns presigned URL and key
      when(
        () => mockDio.get<Map<String, dynamic>>(
          '/api/storage/presigned-upload',
          queryParameters: any(named: 'queryParameters'),
        ),
      ).thenAnswer((_) async => Response(
            data: {'url': 'https://s3.example.com/upload', 'key': 'audio/abc123.aac'},
            statusCode: 200,
            requestOptions: RequestOptions(path: ''),
          ));

      // Act
      final key = await svc.upload(file: tempFile, fileName: 'test.aac');

      // Assert
      expect(key, equals('audio/abc123.aac'));
    });

    test('throws when backend presign call fails', () async {
      when(
        () => mockDio.get<Map<String, dynamic>>(
          '/api/storage/presigned-upload',
          queryParameters: any(named: 'queryParameters'),
        ),
      ).thenThrow(DioException(
        requestOptions: RequestOptions(path: ''),
        type: DioExceptionType.connectionTimeout,
      ));

      await expectLater(
        svc.upload(file: tempFile, fileName: 'test.aac'),
        throwsA(isA<DioException>()),
      );
    });

    test('passes correct fileName as query parameter', () async {
      when(
        () => mockDio.get<Map<String, dynamic>>(
          '/api/storage/presigned-upload',
          queryParameters: {'fileName': 'my_audio.aac'},
        ),
      ).thenAnswer((_) async => Response(
            data: {'url': 'https://s3.example.com/upload', 'key': 'k1'},
            statusCode: 200,
            requestOptions: RequestOptions(path: ''),
          ));

      await svc.upload(file: tempFile, fileName: 'my_audio.aac');

      verify(
        () => mockDio.get<Map<String, dynamic>>(
          '/api/storage/presigned-upload',
          queryParameters: {'fileName': 'my_audio.aac'},
        ),
      ).called(1);
    });
  });
}
