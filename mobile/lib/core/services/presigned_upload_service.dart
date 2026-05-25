import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';

class PresignedUploadService {
  const PresignedUploadService({required Dio dio}) : _dio = dio;

  final Dio _dio;

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
    final uploadDio = Dio();
    await uploadDio.put<void>(
      uploadUrl,
      data: Stream.fromIterable([bytes]),
      options: Options(
        headers: {
          HttpHeaders.contentLengthHeader: bytes.length,
          HttpHeaders.contentTypeHeader: contentType,
        },
        sendTimeout: const Duration(minutes: 2),
        receiveTimeout: const Duration(minutes: 2),
      ),
    );
  }
}
