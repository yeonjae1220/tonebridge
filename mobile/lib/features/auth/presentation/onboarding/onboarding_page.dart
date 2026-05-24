import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/auth/presentation/onboarding/language_select_page.dart';

/// Multi-step onboarding wizard:
///   Step 1 — Select native language (+ optional dialect)
///   Step 2 — Select fluent languages
///   Step 3 — Select languages to learn
class OnboardingPage extends ConsumerStatefulWidget {
  const OnboardingPage({super.key});

  @override
  ConsumerState<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends ConsumerState<OnboardingPage> {
  final PageController _controller = PageController();
  int _currentStep = 0;

  String? _nativeLanguage;
  String? _nativeDialect;
  List<String> _fluentLanguages = [];
  Map<String, String> _fluentLanguageVariants = {};
  List<String> _learningLanguages = [];
  Map<String, String> _learningLanguageVariants = {};

  bool _isSaving = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _nextStep() {
    if (_currentStep < 2) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
      setState(() => _currentStep++);
    }
  }

  Future<void> _finish() async {
    if (_nativeLanguage == null) return;
    setState(() => _isSaving = true);
    try {
      await ref.read(authStateProvider.notifier).completeOnboarding(
            nativeLanguage: _nativeLanguage!,
            fluentLanguages: _fluentLanguages,
            learningLanguages: _learningLanguages,
            nativeDialect: _nativeDialect,
            fluentLanguageVariants: _fluentLanguageVariants,
            learningLanguageVariants: _learningLanguageVariants,
          );
      if (!mounted) return;
      context.go(AppRoute.feed);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('저장 중 오류: $e')),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('프로필 설정 (${_currentStep + 1}/3)'),
        automaticallyImplyLeading: false,
      ),
      body: PageView(
        controller: _controller,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          LanguageSelectPage(
            title: '모국어를 선택하세요',
            subtitle: '가장 자신 있는 언어 하나를 골라주세요.',
            singleSelect: true,
            showDialect: true,
            onChanged: (langs) {
              _nativeLanguage = langs.firstOrNull;
            },
            onDialectChanged: (dialect) => _nativeDialect = dialect,
            onNext: _nextStep,
          ),
          LanguageSelectPage(
            title: '구사 가능한 언어',
            subtitle: '교정해 줄 수 있는 언어를 모두 선택하세요.',
            singleSelect: false,
            showDialect: true,
            onChanged: (langs) => _fluentLanguages = langs,
            onVariantsChanged: (v) => _fluentLanguageVariants = v,
            onNext: _nextStep,
          ),
          LanguageSelectPage(
            title: '배우고 싶은 언어',
            subtitle: '교정받고 싶은 언어를 선택하세요.',
            singleSelect: false,
            showDialect: true,
            onChanged: (langs) => _learningLanguages = langs,
            onVariantsChanged: (v) => _learningLanguageVariants = v,
            onNext: _finish,
            nextLabel: _isSaving ? '저장 중...' : '시작하기',
            isLoading: _isSaving,
          ),
        ],
      ),
    );
  }
}
