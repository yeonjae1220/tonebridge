import 'dart:io';

import 'package:dio/dio.dart';

class PresignedUploadService {
  const PresignedUploadService({required Dio dio}) : _dio = dio;

  final Dio _dio;

  /// Uploads [file] and returns the storage key.
  Future<String> upload({
    required File file,
    required String fileName,
  }) async {
    // 1. Get presigned upload URL from backend
    final metaRes = await _dio.get<Map<String, dynamic>>(
      '/api/storage/presigned-upload',
      queryParameters: {'fileName': fileName},
    );
    final uploadUrl = metaRes.data!['url'] as String;
    final key = metaRes.data!['key'] as String;

    // 2. PUT file directly to S3
    final bytes = await file.readAsBytes();
    await _putBytes(uploadUrl, bytes);

    return key;
  }

  /// Uploads [file] directly to a presigned [uploadUrl] (URL already obtained from backend).
  Future<void> uploadToUrl({
    required File file,
    required String uploadUrl,
  }) async {
    final bytes = await file.readAsBytes();
    await _putBytes(uploadUrl, bytes);
  }

  Future<void> _putBytes(String uploadUrl, List<int> bytes) async {
    final uploadDio = Dio();
    await uploadDio.put<void>(
      uploadUrl,
      data: Stream.fromIterable([bytes]),
      options: Options(
        headers: {
          HttpHeaders.contentLengthHeader: bytes.length,
          HttpHeaders.contentTypeHeader: 'audio/aac',
        },
        sendTimeout: const Duration(minutes: 2),
        receiveTimeout: const Duration(minutes: 2),
      ),
    );
  }
}
