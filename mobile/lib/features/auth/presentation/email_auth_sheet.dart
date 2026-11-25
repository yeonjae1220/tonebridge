import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/core/utils/legal_links.dart';
import 'package:tonebridge/features/auth/presentation/auth_error_message.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/auth/presentation/auth_strings.dart';

/// Mirrors backend `RegisterRequest` rules so most mistakes are caught before the request.
final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
final _usernamePattern = RegExp(r'^[a-zA-Z0-9_]{2,20}$');
final _passwordPattern = RegExp(
  r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#^()\-])[A-Za-z\d@$!%*?&_#^()\-]{8,72}$',
);

Future<void> showEmailAuthSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const EmailAuthSheet(),
  );
}

/// Email sign-in / sign-up form. Errors are shown inline; on success the auth
/// state changes and the router leaves the login screen, so the sheet just closes.
class EmailAuthSheet extends ConsumerStatefulWidget {
  const EmailAuthSheet({super.key});

  @override
  ConsumerState<EmailAuthSheet> createState() => _EmailAuthSheetState();
}

class _EmailAuthSheetState extends ConsumerState<EmailAuthSheet> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _isSignUp = false;
  bool _submitting = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting || !(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final auth = ref.read(authStateProvider.notifier);
    try {
      if (_isSignUp) {
        await auth.registerWithEmail(
          email: _email.text,
          username: _username.text,
          password: _password.text,
        );
      } else {
        await auth.signInWithEmail(
          email: _email.text,
          password: _password.text,
        );
      }
      if (mounted) Navigator.of(context).pop();
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() => _error = authErrorMessage(e, ref.read(tProvider)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _toggleMode() {
    setState(() {
      _isSignUp = !_isSignUp;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    final theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        0,
        24,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                _isSignUp ? t.emailSignUpTitle : t.emailSignInTitle,
                style: theme.textTheme.titleLarge,
              ),
              const SizedBox(height: 20),
              TextFormField(
                key: const Key('email-field'),
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                autocorrect: false,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(labelText: t.emailLabel),
                validator: (v) =>
                    _emailPattern.hasMatch(v?.trim() ?? '') ? null : t.invalidEmail,
              ),
              if (_isSignUp) ...[
                const SizedBox(height: 12),
                TextFormField(
                  key: const Key('username-field'),
                  controller: _username,
                  autofillHints: const [AutofillHints.newUsername],
                  autocorrect: false,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: t.usernameLabel,
                    helperText: t.usernameRule,
                  ),
                  validator: (v) => _usernamePattern.hasMatch(v?.trim() ?? '')
                      ? null
                      : t.usernameRule,
                ),
              ],
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('password-field'),
                controller: _password,
                obscureText: _obscure,
                autofillHints: [
                  _isSignUp ? AutofillHints.newPassword : AutofillHints.password,
                ],
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  labelText: t.passwordLabel,
                  helperText: _isSignUp ? t.passwordRule : null,
                  helperMaxLines: 2,
                  suffixIcon: IconButton(
                    tooltip: t.passwordLabel,
                    icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                // Sign-in only checks presence: older accounts may predate the current rule.
                validator: (v) {
                  final value = v ?? '';
                  if (!_isSignUp) return value.isEmpty ? t.passwordRequired : null;
                  return _passwordPattern.hasMatch(value) ? null : t.passwordRule;
                },
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  key: const Key('email-auth-error'),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.error,
                  ),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton(
                key: const Key('email-submit'),
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(_isSignUp ? t.signUpAction : t.signInAction),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _submitting ? null : _toggleMode,
                child: Text(_isSignUp ? t.switchToSignIn : t.switchToSignUp),
              ),
              if (!_isSignUp)
                TextButton(
                  onPressed: () => openLegalPage(LegalPage.forgotPassword),
                  child: Text(t.forgotPassword),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
