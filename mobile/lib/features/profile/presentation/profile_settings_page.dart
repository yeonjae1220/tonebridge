import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/profile/data/profile_repository_impl.dart';
import 'package:tonebridge/features/profile/presentation/profile_provider.dart';

class ProfileSettingsPage extends ConsumerWidget {
  const ProfileSettingsPage({super.key});

  Future<void> _confirmSignOut(BuildContext context, WidgetRef ref, ToneBridgeStrings strings) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(strings.logout),
        content: Text(strings.signOutConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(strings.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(strings.logout),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(authStateProvider.notifier).signOut();
    }
  }

  Future<void> _confirmDeleteAccount(BuildContext context, WidgetRef ref, ToneBridgeStrings strings) async {
    final first = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(strings.deleteAccount),
        content: Text(strings.deleteAccountConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(strings.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(ctx).colorScheme.error,
            ),
            child: Text(strings.continueAction),
          ),
        ],
      ),
    );
    if (first != true || !context.mounted) return;

    final second = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(strings.deleteAccountSecondTitle),
        content: Text(strings.deleteAccountSecondConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(strings.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            child: Text(strings.deleteAccount),
          ),
        ],
      ),
    );
    if (second != true) return;

    try {
      await ref.read(authStateProvider.notifier).deleteAccount();
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(strings.deleteAccountFailed)),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final strings = ref.watch(tProvider);
    final uiLanguage = ref.watch<String>(uiLanguageProvider);
    final authState = ref.watch(authStateProvider);
    final session = authState.value;
    return Scaffold(
      appBar: AppBar(title: Text(strings.settings)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(strings.uiLanguage, style: theme.textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(
                    strings.uiLanguageSubtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: uiLanguage,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    items: [
                      for (final language in uiLanguageOptions)
                        DropdownMenuItem(
                          value: language.code,
                          child: Text('${language.flag} ${language.label}'),
                        ),
                    ],
                    onChanged: session == null
                        ? null
                        : (value) async {
                            if (value == null) return;
                            await ref.read(profileRepositoryProvider).updateLanguages(
                                  nativeLanguage: session.user.nativeLanguage,
                                  uiLanguage: value,
                                  fluentLanguages: session.user.fluentLanguages,
                                  learningLanguages: session.user.learningLanguages,
                                  nativeDialect: session.user.nativeDialect,
                                  fluentLanguageVariants: session.user.fluentLanguageVariants,
                                  learningLanguageVariants: session.user.learningLanguageVariants,
                                );
                            ref.invalidate(authStateProvider);
                            ref.invalidate(userProfileProvider);
                          },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            strings.account,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.logout_rounded),
                  title: Text(strings.logout),
                  subtitle: Text(strings.logoutSubtitle),
                  onTap: () => _confirmSignOut(context, ref, strings),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Icon(
                    Icons.person_remove_outlined,
                    color: theme.colorScheme.error,
                  ),
                  title: Text(
                    strings.deleteAccount,
                    style: TextStyle(color: theme.colorScheme.error),
                  ),
                  subtitle: Text(strings.deleteAccountSubtitle),
                  onTap: () => _confirmDeleteAccount(context, ref, strings),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
