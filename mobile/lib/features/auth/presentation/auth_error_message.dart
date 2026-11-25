import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/features/auth/presentation/auth_strings.dart';

/// Turns a sign-in failure into a short, localized message.
/// Server error codes come from backend `ErrorCode`; anything unrecognised is
/// logged and shown as a generic retry message rather than a raw exception.
String authErrorMessage(Object error, ToneBridgeStrings t) {
  if (error is DioException) {
    final data = error.response?.data;
    final code = data is Map ? data['code'] : null;
    switch (code) {
      case 'AUTH_005':
        return t.loginFailed;
      case 'AUTH_006':
        return t.tooManyAttempts;
      case 'USER_002':
        return t.emailTaken;
      case 'USER_003':
        return t.usernameTaken;
    }
    if (error.response == null) return t.networkErrorRetry;
  }
  _logFailure(error);
  return t.unexpectedSignInError;
}

/// A DioException's text includes the request, which for sign-in carries the
/// password or identity token — so release builds log only its type and status.
void _logFailure(Object error) {
  if (kDebugMode) {
    debugPrint('[auth] sign-in failed: $error');
    return;
  }
  final status = error is DioException ? error.response?.statusCode : null;
  debugPrint('[auth] sign-in failed: ${error.runtimeType} status=$status');
}
