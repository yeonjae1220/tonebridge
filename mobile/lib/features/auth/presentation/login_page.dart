import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/core/utils/legal_links.dart';
import 'package:tonebridge/features/auth/presentation/auth_error_message.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/auth/presentation/auth_strings.dart';
import 'package:tonebridge/features/auth/presentation/email_auth_sheet.dart';

/// Sign in with Apple is offered on iOS only — App Store guideline 4.8 requires it
/// there because Google sign-in is offered; Android has no such rule.
bool get _offersAppleSignIn =>
    !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key, this.offerAppleSignIn});

  /// Overrides the platform check (tests).
  final bool? offerAppleSignIn;

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  bool _isLoading = false;
  bool _errorShown = false;
  final _termsTap = TapGestureRecognizer()
    ..onTap = () => openLegalPage(LegalPage.terms);
  final _privacyTap = TapGestureRecognizer()
    ..onTap = () => openLegalPage(LegalPage.privacy);

  @override
  void dispose() {
    _termsTap.dispose();
    _privacyTap.dispose();
    super.dispose();
  }

  Future<void> _signIn(Future<void> Function(AuthState auth) action) async {
    setState(() => _isLoading = true);
    try {
      await action(ref.read(authStateProvider.notifier));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
    // Errors are surfaced via ref.listen / the startup check in build().
  }

  void _showError(Object error) {
    final t = ref.read(tProvider);
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t.signInErrorTitle),
        content: Text(authErrorMessage(error, t)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(t.okAction),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Transition listener: catches sign-in errors triggered by a button press.
    // A retry's AsyncLoading keeps the previous error (Riverpod 3), so "the
    // previous state had no error" would skip every failure after the first;
    // key on a load that just finished with an error instead.
    ref.listen(authStateProvider, (previous, next) {
      final finishedWithError = next.hasError &&
          !next.isLoading &&
          (previous == null || previous.isLoading || !previous.hasError);
      if (finishedWithError && mounted) {
        _errorShown = true;
        _showError(next.error!);
      }
    });

    // Startup check: errors already in state when the page first mounts
    // (e.g. session restore failed on app launch).
    final authState = ref.watch(authStateProvider);
    if (authState.hasError && !_errorShown) {
      _errorShown = true;
      final error = authState.error!;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _showError(error);
      });
    }
    if (!authState.hasError) _errorShown = false;

    final t = ref.watch(tProvider);
    final theme = Theme.of(context);
    final isLoading = _isLoading || authState.isLoading;
    final showApple = widget.offerAppleSignIn ?? _offersAppleSignIn;

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
              Text(
                t.friendLearningIntro,
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
                ),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              if (isLoading)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      const SizedBox(width: 12),
                      Text(t.signingIn),
                    ],
                  ),
                ),
              if (showApple) ...[
                SignInWithAppleButton(
                  key: const Key('apple-sign-in'),
                  text: t.continueWithApple,
                  height: 52,
                  style: theme.brightness == Brightness.dark
                      ? SignInWithAppleButtonStyle.white
                      : SignInWithAppleButtonStyle.black,
                  borderRadius: const BorderRadius.all(Radius.circular(26)),
                  onPressed: isLoading
                      ? null
                      : () => _signIn((auth) => auth.signInWithApple()),
                ),
                const SizedBox(height: 12),
              ],
              FilledButton.icon(
                key: const Key('google-sign-in'),
                onPressed: isLoading
                    ? null
                    : () => _signIn((auth) => auth.signInWithGoogle()),
                icon: const Icon(Icons.login),
                label: Text(t.continueWithGoogle),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  textStyle: theme.textTheme.titleMedium,
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                key: const Key('email-sign-in'),
                onPressed: isLoading ? null : () => showEmailAuthSheet(context),
                icon: const Icon(Icons.mail_outline),
                label: Text(t.continueWithEmail),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  textStyle: theme.textTheme.titleMedium,
                ),
              ),
              const SizedBox(height: 20),
              _TermsNotice(
                t: t,
                termsTap: _termsTap,
                privacyTap: _privacyTap,
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

/// "By continuing you agree to {terms} and {privacy}" with both names tappable.
class _TermsNotice extends StatelessWidget {
  const _TermsNotice({
    required this.t,
    required this.termsTap,
    required this.privacyTap,
  });

  final ToneBridgeStrings t;
  final GestureRecognizer termsTap;
  final GestureRecognizer privacyTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.textTheme.bodySmall?.copyWith(
      color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
    );
    final link = base?.copyWith(
      color: theme.colorScheme.primary,
      decoration: TextDecoration.underline,
    );

    final spans = <InlineSpan>[];
    final template = t.agreeToTermsTemplate;
    var cursor = 0;
    for (final match in RegExp(r'\{(terms|privacy)\}').allMatches(template)) {
      spans.add(TextSpan(text: template.substring(cursor, match.start)));
      final isTerms = match.group(1) == 'terms';
      spans.add(TextSpan(
        text: isTerms ? t.termsOfService : t.privacyPolicy,
        style: link,
        recognizer: isTerms ? termsTap : privacyTap,
      ));
      cursor = match.end;
    }
    spans.add(TextSpan(text: template.substring(cursor)));

    return Text.rich(
      TextSpan(style: base, children: spans),
      textAlign: TextAlign.center,
    );
  }
}
