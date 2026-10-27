import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/core/storage/secure_storage_service.dart';
import 'package:tonebridge/features/auth/data/auth_repository_impl.dart';
import 'package:tonebridge/features/auth/domain/auth_repository.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';

class _MockStorage extends Mock implements SecureStorageService {}

class _MockAuthRepository extends Mock implements AuthRepository {}

/// 저장된 토큰으로 세션을 검증하다 실패했을 때, 토큰을 지워도 되는 건 401(자격 없음 확정)뿐이다.
void main() {
  late _MockStorage storage;
  late _MockAuthRepository repo;

  setUp(() {
    storage = _MockStorage();
    repo = _MockAuthRepository();
    when(() => storage.readAccessToken()).thenAnswer((_) async => 'stored-token');
    when(() => storage.clearAll()).thenAnswer((_) async {});
  });

  ProviderContainer makeContainer() {
    final container = ProviderContainer(
      // Riverpod 3 의 자동 재시도가 실패 상태를 다시 loading 으로 돌리지 않게 끈다.
      retry: (_, _) => null,
      overrides: [
        secureStorageServiceProvider.overrideWithValue(storage),
        authRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  DioException dioError(int status) => DioException(
        requestOptions: RequestOptions(path: '/api/users/me'),
        response: Response<void>(
          requestOptions: RequestOptions(path: '/api/users/me'),
          statusCode: status,
        ),
      );

  Future<void> settle(ProviderContainer container) async {
    try {
      await container.read(authStateProvider.future);
    } catch (_) {}
  }

  test('401 clears stored tokens and resolves to logged out', () async {
    when(() => repo.getCurrentUser()).thenThrow(dioError(401));

    final container = makeContainer();
    final session = await container.read(authStateProvider.future);

    expect(session, isNull);
    verify(() => storage.clearAll()).called(1);
  });

  test('5xx keeps tokens and surfaces the error', () async {
    when(() => repo.getCurrentUser()).thenThrow(dioError(503));

    final container = makeContainer();
    await settle(container);

    expect(container.read(authStateProvider).hasError, isTrue);
    verifyNever(() => storage.clearAll());
  });

  test('non-Dio failure (e.g. response parsing) keeps tokens and surfaces the error', () async {
    when(() => repo.getCurrentUser()).thenThrow(const FormatException('bad user json'));

    final container = makeContainer();
    await settle(container);

    expect(container.read(authStateProvider).hasError, isTrue);
    verifyNever(() => storage.clearAll());
  });
}
