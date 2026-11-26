import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/features/safety/data/safety_repository_impl.dart';
import 'package:tonebridge/features/safety/domain/safety_repository.dart';

class BlockedUsersState {
  const BlockedUsersState({required this.users, required this.nextPage});

  final List<BlockedUser> users;
  final int? nextPage;

  bool get hasMore => nextPage != null;
}

final blockedUsersProvider =
    AsyncNotifierProvider.autoDispose<BlockedUsersNotifier, BlockedUsersState>(
      BlockedUsersNotifier.new,
    );

class BlockedUsersNotifier extends AsyncNotifier<BlockedUsersState> {
  @override
  Future<BlockedUsersState> build() async {
    final page = await ref.watch(safetyRepositoryProvider).blockedUsers();
    return BlockedUsersState(users: page.items, nextPage: page.nextPage);
  }

  Future<void> loadMore() async {
    final current = state.value;
    final next = current?.nextPage;
    if (current == null || next == null) return;
    final page = await ref.read(safetyRepositoryProvider).blockedUsers(page: next);
    state = AsyncData(
      BlockedUsersState(
        users: [...current.users, ...page.items],
        nextPage: page.nextPage,
      ),
    );
  }

  Future<void> unblock(String userId) async {
    await ref.read(safetyRepositoryProvider).unblock(userId);
    final current = state.value;
    if (current == null) return;
    state = AsyncData(
      BlockedUsersState(
        users: [
          for (final user in current.users)
            if (user.userId != userId) user,
        ],
        nextPage: current.nextPage,
      ),
    );
  }
}
