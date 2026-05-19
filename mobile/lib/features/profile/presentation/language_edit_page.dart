import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/features/auth/presentation/onboarding/language_select_page.dart';
import 'package:tonebridge/features/profile/domain/model/user_profile.dart';
import 'package:tonebridge/features/profile/presentation/language_edit_provider.dart';

class LanguageEditPage extends ConsumerStatefulWidget {
  const LanguageEditPage({required this.profile, super.key});

  final UserProfile profile;

  @override
  ConsumerState<LanguageEditPage> createState() => _LanguageEditPageState();
}

class _LanguageEditPageState extends ConsumerState<LanguageEditPage> {
  late String _nativeLanguage;
  late List<String> _fluentLanguages;
  late List<String> _learningLanguages;

  int _step = 0; // 0: native, 1: fluent, 2: learning

  @override
  void initState() {
    super.initState();
    _nativeLanguage = widget.profile.nativeLanguage;
    _fluentLanguages = List.of(widget.profile.fluentLanguages);
    _learningLanguages = List.of(widget.profile.learningLanguages);
  }

  Future<void> _save() async {
    final success = await ref.read(languageEditProvider.notifier).save(
          nativeLanguage: _nativeLanguage,
          fluentLanguages: _fluentLanguages,
          learningLanguages: _learningLanguages,
        );
    if (!mounted) return;
    if (success) {
      context.pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('저장에 실패했습니다. 다시 시도해 주세요.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final editState = ref.watch(languageEditProvider);
    final isLoading = editState.isLoading;

    return Scaffold(
      appBar: AppBar(
        title: Text(_stepTitle),
        leading: BackButton(onPressed: _step == 0 ? context.pop : _goBack),
      ),
      body: switch (_step) {
        0 => LanguageSelectPage(
            key: const ValueKey(0),
            title: '모국어',
            subtitle: '모국어를 선택하세요.',
            singleSelect: true,
            initialValues: [_nativeLanguage],
            onChanged: (langs) {
              if (langs.isNotEmpty) _nativeLanguage = langs.first;
            },
            onNext: () => setState(() => _step = 1),
          ),
        1 => LanguageSelectPage(
            key: const ValueKey(1),
            title: '구사 가능 언어',
            subtitle: '유창하게 구사할 수 있는 언어를 선택하세요.',
            singleSelect: false,
            initialValues: _fluentLanguages,
            onChanged: (langs) => _fluentLanguages = langs,
            onNext: () => setState(() => _step = 2),
          ),
        _ => LanguageSelectPage(
            key: const ValueKey(2),
            title: '학습 중인 언어',
            subtitle: '현재 학습 중인 언어를 선택하세요.',
            singleSelect: false,
            initialValues: _learningLanguages,
            onChanged: (langs) => _learningLanguages = langs,
            onNext: _save,
            nextLabel: '저장',
            isLoading: isLoading,
          ),
      },
    );
  }

  String get _stepTitle => switch (_step) {
        0 => '모국어 설정',
        1 => '구사 가능 언어',
        _ => '학습 언어 설정',
      };

  void _goBack() => setState(() => _step -= 1);
}
