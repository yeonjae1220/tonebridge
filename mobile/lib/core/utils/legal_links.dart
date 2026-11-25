import 'package:tonebridge/core/config/app_config.dart';
import 'package:url_launcher/url_launcher.dart';

/// Public pages on the web app that store review and users need to reach from the app.
enum LegalPage {
  terms('/terms'),
  privacy('/privacy'),
  forgotPassword('/forgot-password');

  const LegalPage(this.path);
  final String path;

  Uri get uri => Uri.parse(AppConfig.webBaseUrl).replace(path: path);
}

/// Opens [page] in an in-app browser view. Returns false if nothing could open it.
Future<bool> openLegalPage(LegalPage page) {
  return launchUrl(page.uri, mode: LaunchMode.inAppBrowserView);
}
