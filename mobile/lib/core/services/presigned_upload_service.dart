import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';

class PresignedUploadService {
  const PresignedUploadService({required Dio dio}) : _dio = dio;

  final Dio _dio;

  // Separate instance without auth interceptors for direct S3 PUT.
  // Static so it is shared across uploads rather than recreated each call.
  static final _s3Dio = Dio();

  /// Uploads [file] (native) and returns the storage key.
  Future<String> upload({
    required File file,
    required String fileName,
  }) async {
    final metaRes = await _dio.get<Map<String, dynamic>>(
      '/api/storage/presigned-upload',
      queryParameters: {'fileName': fileName},
    );
    final uploadUrl = metaRes.data!['url'] as String;
    final key = metaRes.data!['key'] as String;
    await _putBytes(uploadUrl, await file.readAsBytes());
    return key;
  }

  /// Uploads [file] (native) to an already-obtained presigned [uploadUrl].
  Future<void> uploadToUrl({
    required File file,
    required String uploadUrl,
  }) async {
    await _putBytes(uploadUrl, await file.readAsBytes());
  }

  /// Obtains a presigned URL from the backend and uploads raw [bytes] (web).
  /// Returns the storage key.
  Future<String> uploadBytes({
    required Uint8List bytes,
    required String fileName,
  }) async {
    final metaRes = await _dio.get<Map<String, dynamic>>(
      '/api/storage/presigned-upload',
      queryParameters: {'fileName': fileName},
    );
    final uploadUrl = metaRes.data!['url'] as String;
    final key = metaRes.data!['key'] as String;
    await _putBytes(uploadUrl, bytes, contentType: 'audio/webm');
    return key;
  }

  /// Uploads raw [bytes] (web) to an already-obtained presigned [uploadUrl].
  Future<void> uploadBytesToUrl({
    required Uint8List bytes,
    required String uploadUrl,
  }) async {
    await _putBytes(uploadUrl, bytes, contentType: 'audio/webm');
  }

  Future<void> _putBytes(
    String uploadUrl,
    List<int> bytes, {
    String contentType = 'audio/aac',
  }) async {
    await _s3Dio.put<void>(
      uploadUrl,
      data: Stream.fromIterable([bytes]),
      options: Options(
        headers: {
          'content-length': bytes.length,
          'content-type': contentType,
        },
        sendTimeout: const Duration(minutes: 2),
        receiveTimeout: const Duration(minutes: 2),
      ),
    );
  }
}
