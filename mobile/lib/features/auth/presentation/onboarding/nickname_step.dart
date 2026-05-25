import 'package:flutter/material.dart';

class NicknameStep extends StatefulWidget {
  const NicknameStep({
    super.key,
    required this.initialValue,
    required this.onChanged,
    required this.onNext,
    this.isLoading = false,
  });

  final String initialValue;
  final ValueChanged<String> onChanged;
  final VoidCallback onNext;
  final bool isLoading;

  @override
  State<NicknameStep> createState() => _NicknameStepState();
}

class _NicknameStepState extends State<NicknameStep> {
  late final TextEditingController _controller;
  final _formKey = GlobalKey<FormState>();

  static final _usernameRegex = RegExp(r'^[a-zA-Z0-9_]+$');

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String? _validate(String? value) {
    if (value == null || value.isEmpty) return '닉네임을 입력해주세요';
    if (value.length < 2) return '2자 이상 입력해주세요';
    if (value.length > 20) return '20자 이하로 입력해주세요';
    if (!_usernameRegex.hasMatch(value)) {
      return '영문, 숫자, 언더스코어(_)만 사용할 수 있습니다';
    }
    return null;
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      widget.onChanged(_controller.text.trim());
      widget.onNext();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 32),
            Text(
              '닉네임을 설정하세요',
              style: theme.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              '친구 추가 시 사용할 고유한 이름이에요.',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: theme.colorScheme.outline),
            ),
            const SizedBox(height: 32),
            TextFormField(
              controller: _controller,
              autofocus: true,
              validator: _validate,
              onChanged: (v) => widget.onChanged(v.trim()),
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: '닉네임',
                hintText: 'user_name123',
                helperText: '영문, 숫자, 언더스코어 2~20자',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                prefixIcon: const Icon(Icons.person_outline_rounded),
              ),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: widget.isLoading ? null : _submit,
                child: widget.isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('다음'),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
