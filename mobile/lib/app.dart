import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/core/router/app_router.dart';

class ToneBridgeApp extends ConsumerWidget {
  const ToneBridgeApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final uiLanguage = ref.watch<String>(uiLanguageProvider);

    return MaterialApp.router(
      title: 'ToneBridge',
      debugShowCheckedModeBanner: false,
      locale: localeForUiLanguage(uiLanguage),
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF6750A4),
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF6750A4),
        brightness: Brightness.dark,
      ),
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}
