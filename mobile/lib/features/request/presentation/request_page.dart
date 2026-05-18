import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tonebridge/core/config/app_config.dart';
import 'package:tonebridge/core/router/app_router.dart';
import 'package:tonebridge/features/request/presentation/request_provider.dart';

class RequestPage extends ConsumerStatefulWidget {
  const RequestPage({super.key});

  @override
  ConsumerState<RequestPage> createState() => _RequestPageState();
}

class _RequestPageState extends ConsumerState<RequestPage> {
  final _formKey = GlobalKey<FormState>();
  final _textController = TextEditingController();
  final _contextController = TextEditingController();

  String _targetLanguage = 'English';
  String? _targetVariant;
  final List<String> _feedbackGoals = [];
  bool _isAudio = false;

  static const _languages = [
    'English', 'Japanese', 'Chinese', 'French', 'Spanish',
    'German', 'Korean', 'Portuguese',
  ];

  static const _goals = [
    '자연스러운 표현', '문법 교정', '발음 피드백',
    '억양 교정', '어휘 선택', '격식체/비격식체',
  ];

  @override
  void dispose() {
    _textController.dispose();
    _contextController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final requestAsync = ref.watch(requestStateProvider);
    final isLoading = requestAsync.isLoading;

    ref.listen(requestStateProvider, (previous, next) {
      if (next.hasError && !(previous?.hasError ?? false) && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('요청 제출에 실패했습니다.'),
            backgroundColor: theme.colorScheme.error,
          ),
        );
      }
      if (next.hasValue && next.value != null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('교정 요청이 등록됐습니다!')),
        );
        ref.read(requestStateProvider.notifier).reset();
        if (!mounted) return;
        context.go(AppRoute.feed);
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text('교정 요청')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _SectionLabel(label: '언어 선택'),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _targetLanguage,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: '교정받을 언어',
              ),
              items: _languages
                  .map((l) => DropdownMenuItem(value: l, child: Text(l)))
                  .toList(),
              onChanged: (v) => setState(() => _targetLanguage = v!),
            ),
            const SizedBox(height: 24),
            _SectionLabel(label: '요청 유형'),
            const SizedBox(height: 8),
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(
                  value: false,
                  icon: Icon(Icons.text_fields_rounded),
                  label: Text('텍스트'),
                ),
                ButtonSegment(
                  value: true,
                  icon: Icon(Icons.mic_rounded),
                  label: Text('음성'),
                ),
              ],
              selected: {_isAudio},
              onSelectionChanged: (s) => setState(() => _isAudio = s.first),
            ),
            const SizedBox(height: 24),
            if (!_isAudio) ...[
              _SectionLabel(label: '교정받을 내용'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _textController,
                minLines: 4,
                maxLines: 8,
                maxLength: 1000,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: '교정받고 싶은 문장을 입력하세요',
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return '내용을 입력해주세요';
                  return null;
                },
              ),
            ] else ...[
              _AudioRecordSection(),
            ],
            const SizedBox(height: 24),
            _SectionLabel(label: '컨텍스트 (선택)'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _contextController,
              maxLines: 2,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: '상황이나 배경을 설명해주세요 (선택사항)',
              ),
            ),
            const SizedBox(height: 24),
            _SectionLabel(label: '피드백 목표 (선택)'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _goals.map((g) {
                final selected = _feedbackGoals.contains(g);
                return FilterChip(
                  label: Text(g),
                  selected: selected,
                  onSelected: (v) => setState(() {
                    if (v) {
                      _feedbackGoals.add(g);
                    } else {
                      _feedbackGoals.remove(g);
                    }
                  }),
                );
              }).toList(),
            ),
            const SizedBox(height: 32),
            _CreditCostBanner(isAudio: _isAudio),
            const SizedBox(height: 16),
            if (_isAudio)
              OutlinedButton.icon(
                onPressed: null,
                icon: const Icon(Icons.mic_off_rounded),
                label: const Text('음성 요청 기능 준비 중'),
              )
            else
              FilledButton(
                onPressed: isLoading ? null : _submit,
                child: isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('교정 요청 제출'),
              ),
          ],
        ),
      ),
    );
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    if (_isAudio) {
      // 음성 요청은 AudioRecordSection에서 직접 처리
      return;
    }
    ref.read(requestStateProvider.notifier).submitText(
          targetLanguage: _targetLanguage,
          targetVariant: _targetVariant,
          contentText: _textController.text.trim(),
          context: _contextController.text.trim().isEmpty
              ? null
              : _contextController.text.trim(),
          feedbackGoals: List.from(_feedbackGoals),
        );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: Theme.of(context).textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
    );
  }
}

class _CreditCostBanner extends StatelessWidget {
  const _CreditCostBanner({required this.isAudio});
  final bool isAudio;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cost = isAudio ? AppConfig.audioRequestCost : AppConfig.textRequestCost;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.toll_rounded, color: theme.colorScheme.primary, size: 20),
          const SizedBox(width: 8),
          Text(
            '크레딧 $cost 차감',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _AudioRecordSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      height: 120,
      decoration: BoxDecoration(
        border: Border.all(color: theme.colorScheme.outline.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.mic_rounded, size: 40, color: theme.colorScheme.primary),
            const SizedBox(height: 8),
            Text('음성 녹음 기능 준비 중', style: theme.textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}
