import 'dart:io';

import 'package:dio/dio.dart';

class PresignedUploadService {
  PresignedUploadService({required Dio dio, Dio? uploadDio})
      : _dio = dio,
        _uploadDio = uploadDio;

  final Dio _dio;
  final Dio? _uploadDio;

  /// Uploads [file] to S3 via a presigned URL and returns the storage key.
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
    final uploadDio = _uploadDio ??
        Dio(BaseOptions(
          connectTimeout: const Duration(seconds: 30),
          sendTimeout: const Duration(minutes: 2),
          receiveTimeout: const Duration(minutes: 2),
          validateStatus: (status) => status != null && status < 300,
        ));

    await uploadDio.put<void>(
      uploadUrl,
      data: Stream.fromIterable([bytes]),
      options: Options(
        headers: {
          HttpHeaders.contentLengthHeader: bytes.length,
          HttpHeaders.contentTypeHeader: 'audio/aac',
        },
      ),
    );

    return key;
  }
}
