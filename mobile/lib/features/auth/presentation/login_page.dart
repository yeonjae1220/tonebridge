import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  bool _isLoading = false;

  Future<void> _signInWithGoogle() async {
    setState(() => _isLoading = true);
    try {
      await ref.read(authStateProvider.notifier).signInWithGoogle();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
    // Errors are surfaced via ref.listen below — no catch needed here
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Theme.of(context).colorScheme.error,
        duration: const Duration(seconds: 30),
        action: SnackBarAction(
          label: '닫기',
          textColor: Colors.white,
          onPressed: () =>
              ScaffoldMessenger.of(context).hideCurrentSnackBar(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Show error only on transition to error state to avoid repeated snackbars
    ref.listen(authStateProvider, (previous, next) {
      if (next.hasError && !(previous?.hasError ?? false) && mounted) {
        _showError(next.error.toString());
      }
    });

    final theme = Theme.of(context);
    // Disable button while either local call or provider is in-flight
    final authLoading = ref.watch(authStateProvider).isLoading;
    final isLoading = _isLoading || authLoading;

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Center(
                child: Text(
                  'ToneBridge',
                  style: theme.textTheme.displayMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Center(
                child: Text(
                  '내 언어를 교정받으려면, 남의 언어를 교정하세요.',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: isLoading ? null : _signInWithGoogle,
                icon: isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.login),
                label: Text(isLoading ? '로그인 중...' : 'Google로 계속하기'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  textStyle: theme.textTheme.titleMedium,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '계속하면 이용약관 및 개인정보 처리방침에 동의합니다.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
