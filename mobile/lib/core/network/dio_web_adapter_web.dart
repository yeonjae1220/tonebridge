import 'package:dio/browser.dart';
import 'package:dio/dio.dart';

void configurePlatformDio(Dio dio) {
  dio.httpClientAdapter = BrowserHttpClientAdapter(withCredentials: true);
}
