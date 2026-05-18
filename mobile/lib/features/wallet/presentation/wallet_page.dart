import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/wallet/domain/model/credit_transaction.dart';
import 'package:tonebridge/features/wallet/presentation/wallet_provider.dart';

class WalletPage extends ConsumerWidget {
  const WalletPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(creditHistoryProvider);
    final authAsync = ref.watch(authStateProvider);
    final credits = authAsync.value?.user.credits ?? 0;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('크레딧 지갑')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(creditHistoryProvider),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _CreditBalanceCard(credits: credits),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding:
                    const EdgeInsets.fromLTRB(20, 24, 20, 8),
                child: Text(
                  '거래 내역',
                  style: theme.textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
            ),
            historyAsync.when(
              loading: () => const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.error_outline_rounded,
                          size: 48, color: theme.colorScheme.error),
                      const SizedBox(height: 12),
                      Text('내역을 불러올 수 없습니다',
                          style: theme.textTheme.titleMedium),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: () =>
                            ref.invalidate(creditHistoryProvider),
                        child: const Text('다시 시도'),
                      ),
                    ],
                  ),
                ),
              ),
              data: (history) {
                if (history.isEmpty) {
                  return SliverFillRemaining(
                    child: Center(
                      child: Text(
                        '거래 내역이 없습니다.',
                        style: theme.textTheme.bodyLarge?.copyWith(
                          color: theme.colorScheme.outline,
                        ),
                      ),
                    ),
                  );
                }
                return SliverList.separated(
                  itemCount: history.length,
                  separatorBuilder: (_, __) =>
                      const Divider(indent: 72, height: 1),
                  itemBuilder: (context, index) =>
                      _TransactionTile(tx: history[index]),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _CreditBalanceCard extends StatelessWidget {
  const _CreditBalanceCard({required this.credits});
  final int credits;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.all(20),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            theme.colorScheme.primary,
            theme.colorScheme.primaryContainer,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '보유 크레딧',
            style: theme.textTheme.labelLarge?.copyWith(
              color: theme.colorScheme.onPrimary.withValues(alpha: 0.8),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Icon(Icons.toll_rounded,
                  size: 32, color: theme.colorScheme.onPrimary),
              const SizedBox(width: 8),
              Text(
                '$credits',
                style: theme.textTheme.displaySmall?.copyWith(
                  color: theme.colorScheme.onPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  const _TransactionTile({required this.tx});
  final CreditTransaction tx;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isEarn = tx.amount > 0;
    final (icon, color) = switch (tx.type) {
      'EARN' => (Icons.arrow_downward_rounded, Colors.green),
      'SPEND' => (Icons.arrow_upward_rounded, theme.colorScheme.error),
      'BONUS' => (Icons.star_rounded, Colors.amber),
      'SIGNUP' => (Icons.card_giftcard_rounded, theme.colorScheme.primary),
      _ => (Icons.swap_horiz_rounded, theme.colorScheme.outline),
    };

    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: color, size: 20),
      ),
      title: Text(tx.note ?? _typeLabel(tx.type)),
      subtitle: tx.createdAt != null
          ? Text(
              DateFormat('yyyy.MM.dd HH:mm').format(tx.createdAt!),
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline),
            )
          : null,
      trailing: Text(
        '${isEarn ? '+' : ''}${tx.amount}',
        style: theme.textTheme.titleMedium?.copyWith(
          color: isEarn ? Colors.green : theme.colorScheme.error,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  String _typeLabel(String type) => switch (type) {
        'EARN' => '교정 보상',
        'SPEND' => '요청 차감',
        'BONUS' => '보너스',
        'SIGNUP' => '가입 보너스',
        'PENALTY' => '패널티',
        _ => type,
      };
}
