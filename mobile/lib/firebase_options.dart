// Web options are filled in.
// Android/iOS: run `flutterfire configure` after adding google-services.json
// and GoogleService-Info.plist to replace the REPLACE_ME placeholders.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'Unsupported platform: $defaultTargetPlatform',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyBIsm_sp3e49I6bSCn-IUnrxoQu5U0QvTs',
    authDomain: 'tonebridge-44c8a.firebaseapp.com',
    projectId: 'tonebridge-44c8a',
    storageBucket: 'tonebridge-44c8a.firebasestorage.app',
    messagingSenderId: '890326583669',
    appId: '1:890326583669:web:102b2e7be1cc9f110c2b3c',
    measurementId: 'G-VE2X5X8HNY',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'REPLACE_ME',
    appId: 'REPLACE_ME',
    messagingSenderId: 'REPLACE_ME',
    projectId: 'REPLACE_ME',
    storageBucket: 'REPLACE_ME',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'REPLACE_ME',
    appId: 'REPLACE_ME',
    messagingSenderId: 'REPLACE_ME',
    projectId: 'REPLACE_ME',
    storageBucket: 'REPLACE_ME',
    iosClientId: 'REPLACE_ME',
    iosBundleId: 'me.yeonjae.tonebridge',
  );
}
