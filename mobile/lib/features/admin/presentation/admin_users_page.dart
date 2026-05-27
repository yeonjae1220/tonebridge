import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:tonebridge/features/admin/data/admin_repository.dart';
import 'package:tonebridge/features/admin/domain/admin_models.dart';

class AdminUsersPage extends ConsumerStatefulWidget {
  const AdminUsersPage({super.key});

  @override
  ConsumerState<AdminUsersPage> createState() => _AdminUsersPageState();
}

class _AdminUsersPageState extends ConsumerState<AdminUsersPage> {
  int _page = 0;
  String? _editingUserId;
  final _deltaController = TextEditingController();
  bool _isSaving = false;

  @override
  void dispose() {
    _deltaController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final usersAsync = ref.watch(adminUsersProvider(_page));

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: '대시보드',
          onPressed: () => context.go('/admin'),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        title: const Text('사용자 관리'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(adminUsersProvider(_page)),
        child: usersAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 80),
              const Icon(Icons.error_outline_rounded, size: 56),
              const SizedBox(height: 16),
              const Text('사용자 목록을 불러올 수 없습니다.', textAlign: TextAlign.center),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => ref.invalidate(adminUsersProvider(_page)),
                child: const Text('다시 시도'),
              ),
            ],
          ),
          data: (page) => _UserList(
            page: page,
            editingUserId: _editingUserId,
            deltaController: _deltaController,
            isSaving: _isSaving,
            onPageChanged: (page) => setState(() => _page = page),
            onToggleEdit: (userId) {
              setState(() {
                _editingUserId = _editingUserId == userId ? null : userId;
                _deltaController.clear();
              });
            },
            onSave: _adjustCredits,
          ),
        ),
      ),
    );
  }

  Future<void> _adjustCredits(String userId) async {
    final delta = int.tryParse(_deltaController.text.trim());
    if (delta == null) return;

    setState(() => _isSaving = true);
    try {
      await ref
          .read(adminRepositoryProvider)
          .adjustCredits(userId: userId, delta: delta);
      ref.invalidate(adminUsersProvider(_page));
      setState(() {
        _editingUserId = null;
        _deltaController.clear();
      });
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }
}

class _UserList extends StatelessWidget {
  const _UserList({
    required this.page,
    required this.editingUserId,
    required this.deltaController,
    required this.isSaving,
    required this.onPageChanged,
    required this.onToggleEdit,
    required this.onSave,
  });

  final AdminUserPage page;
  final String? editingUserId;
  final TextEditingController deltaController;
  final bool isSaving;
  final ValueChanged<int> onPageChanged;
  final ValueChanged<String> onToggleEdit;
  final ValueChanged<String> onSave;

  @override
  Widget build(BuildContext context) {
    if (page.users.isEmpty) {
      return const Center(child: Text('사용자가 없습니다.'));
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      itemCount: page.users.length + 1,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        if (index == page.users.length) {
          return _PaginationBar(page: page, onPageChanged: onPageChanged);
        }
        final user = page.users[index];
        return _UserCard(
          user: user,
          isEditing: editingUserId == user.id,
          deltaController: deltaController,
          isSaving: isSaving,
          onToggleEdit: () => onToggleEdit(user.id),
          onSave: () => onSave(user.id),
        );
      },
    );
  }
}

class _UserCard extends StatelessWidget {
  const _UserCard({
    required this.user,
    required this.isEditing,
    required this.deltaController,
    required this.isSaving,
    required this.onToggleEdit,
    required this.onSave,
  });

  final AdminUserSummary user;
  final bool isEditing;
  final TextEditingController deltaController;
  final bool isSaving;
  final VoidCallback onToggleEdit;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 8,
                        children: [
                          Text(
                            user.username,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (user.isAdmin)
                            Chip(
                              label: const Text('관리자'),
                              visualDensity: VisualDensity.compact,
                              avatar: Icon(
                                Icons.verified_user_rounded,
                                size: 16,
                                color: theme.colorScheme.primary,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(user.email, style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed: onToggleEdit,
                  icon: const Icon(Icons.toll_rounded, size: 18),
                  label: const Text('크레딧'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                _Meta(label: '언어', value: user.nativeLanguage),
                _Meta(label: '크레딧', value: '${user.credits}'),
                _Meta(label: '스트릭', value: '${user.correctionStreak}일'),
                _Meta(
                  label: '평판',
                  value: user.reputationScore.toStringAsFixed(1),
                ),
                _Meta(
                  label: '가입',
                  value: DateFormat('yyyy.MM.dd').format(user.createdAt),
                ),
              ],
            ),
            if (isEditing) ...[
              const Divider(height: 28),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: deltaController,
                      keyboardType: const TextInputType.numberWithOptions(
                        signed: true,
                      ),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'^-?\d*')),
                      ],
                      decoration: const InputDecoration(
                        labelText: '조정값',
                        hintText: '예: 10 또는 -5',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  FilledButton(
                    onPressed: isSaving ? null : onSave,
                    child: isSaving
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('저장'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Text.rich(
      TextSpan(
        text: '$label ',
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.outline,
        ),
        children: [
          TextSpan(
            text: value,
            style: TextStyle(
              color: theme.colorScheme.onSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _PaginationBar extends StatelessWidget {
  const _PaginationBar({required this.page, required this.onPageChanged});

  final AdminUserPage page;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton.filledTonal(
            tooltip: '이전',
            onPressed: page.page > 0
                ? () => onPageChanged(page.page - 1)
                : null,
            icon: const Icon(Icons.chevron_left_rounded),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text('${page.page + 1} / ${page.totalPages}'),
          ),
          IconButton.filledTonal(
            tooltip: '다음',
            onPressed: page.page + 1 < page.totalPages
                ? () => onPageChanged(page.page + 1)
                : null,
            icon: const Icon(Icons.chevron_right_rounded),
          ),
        ],
      ),
    );
  }
}
