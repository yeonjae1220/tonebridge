import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/core/providers/core_providers.dart';
import 'package:tonebridge/core/storage/secure_storage_service.dart';
import 'package:tonebridge/features/auth/data/auth_repository_impl.dart';
import 'package:tonebridge/features/auth/domain/auth_repository.dart';
import 'package:tonebridge/features/auth/domain/model/user.dart';
import 'package:tonebridge/features/auth/presentation/auth_error_message.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';
import 'package:tonebridge/features/auth/presentation/login_page.dart';

class _MockStorage extends Mock implements SecureStorageService {}

class _MockAuthRepository extends Mock implements AuthRepository {}

const _user = User(
  id: 'user-1',
  email: 'reviewer@example.com',
  username: 'reviewer',
  nativeLanguage: '',
  fluentLanguages: [],
  learningLanguages: [],
  credits: 0,
);
const _session = AuthSession(user: _user, accessToken: 'access', needsOnboarding: true);

DioException _apiError(int status, String code) => DioException(
      requestOptions: RequestOptions(path: '/api/auth/mobile/login'),
      response: Response<Map<String, dynamic>>(
        requestOptions: RequestOptions(path: '/api/auth/mobile/login'),
        statusCode: status,
        data: {'code': code, 'message': 'server text'},
      ),
    );

void main() {
  late _MockStorage storage;
  late _MockAuthRepository repo;
  late ProviderContainer container;

  setUp(() {
    storage = _MockStorage();
    repo = _MockAuthRepository();
    when(() => storage.readAccessToken()).thenAnswer((_) async => null);
    when(() => repo.restoreSession()).thenAnswer((_) async => null);
  });

  Future<void> pumpLogin(
    WidgetTester tester, {
    String deviceLanguage = 'en',
    bool offerApple = false,
  }) async {
    container = ProviderContainer(
      retry: (_, _) => null,
      overrides: [
        secureStorageServiceProvider.overrideWithValue(storage),
        authRepositoryProvider.overrideWithValue(repo),
        deviceLanguageProvider.overrideWithValue(deviceLanguage),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(home: LoginPage(offerAppleSignIn: offerApple)),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> openEmailSheet(WidgetTester tester) async {
    await tester.tap(find.byKey(const Key('email-sign-in')));
    await tester.pumpAndSettle();
  }

  testWidgets('offers Google and email everywhere, Apple only when enabled (iOS)', (tester) async {
    await pumpLogin(tester);
    expect(find.byKey(const Key('google-sign-in')), findsOneWidget);
    expect(find.byKey(const Key('email-sign-in')), findsOneWidget);
    expect(find.byKey(const Key('apple-sign-in')), findsNothing);

    await pumpLogin(tester, offerApple: true);
    expect(find.byKey(const Key('apple-sign-in')), findsOneWidget);
  });

  testWidgets('before sign-in the screen follows the device language', (tester) async {
    await pumpLogin(tester, deviceLanguage: 'en');
    expect(find.text('Continue with Google'), findsOneWidget);

    await pumpLogin(tester, deviceLanguage: 'ko');
    expect(find.text('Google로 계속하기'), findsOneWidget);

    await pumpLogin(tester, deviceLanguage: 'xx');
    expect(find.text('Google로 계속하기'), findsOneWidget, reason: 'unsupported → Korean');
  });

  testWidgets('terms and privacy policy are named in the notice', (tester) async {
    await pumpLogin(tester);
    final notice = tester
        .widgetList<RichText>(find.byType(RichText))
        .map((w) => w.text.toPlainText())
        .firstWhere((text) => text.contains('Privacy Policy'));
    expect(notice, 'By continuing, you agree to the Terms of Service and Privacy Policy.');
  });

  testWidgets('Apple button signs in through the repository', (tester) async {
    when(() => repo.signInWithApple()).thenAnswer((_) async => _session);
    await pumpLogin(tester, offerApple: true);

    await tester.tap(find.byKey(const Key('apple-sign-in')));
    await tester.pumpAndSettle();

    verify(() => repo.signInWithApple()).called(1);
    expect(container.read(authStateProvider).value, _session);
  });

  testWidgets('every failed Google sign-in shows an error, not only the first', (tester) async {
    when(() => repo.signInWithGoogle()).thenThrow(_apiError(500, 'COMMON_001'));
    await pumpLogin(tester);

    for (var attempt = 1; attempt <= 2; attempt++) {
      await tester.tap(find.byKey(const Key('google-sign-in')));
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsOneWidget, reason: 'attempt $attempt');
      expect(find.text("Couldn't sign you in. Please try again."), findsOneWidget);
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
    }
    verify(() => repo.signInWithGoogle()).called(2);
  });

  testWidgets('cancelling the Google sheet shows no error', (tester) async {
    when(() => repo.signInWithGoogle()).thenAnswer((_) async => null);
    await pumpLogin(tester);

    await tester.tap(find.byKey(const Key('google-sign-in')));
    await tester.pumpAndSettle();

    expect(find.byType(AlertDialog), findsNothing);
    expect(find.byKey(const Key('google-sign-in')), findsOneWidget);
  });

  testWidgets('email sign-in succeeds, updates the session and closes the sheet', (tester) async {
    when(() => repo.signInWithEmail(email: any(named: 'email'), password: any(named: 'password')))
        .thenAnswer((_) async => _session);
    await pumpLogin(tester);
    await openEmailSheet(tester);

    await tester.enterText(find.byKey(const Key('email-field')), 'reviewer@example.com');
    await tester.enterText(find.byKey(const Key('password-field')), 'whatever');
    await tester.tap(find.byKey(const Key('email-submit')));
    await tester.pumpAndSettle();

    verify(() => repo.signInWithEmail(email: 'reviewer@example.com', password: 'whatever')).called(1);
    expect(container.read(authStateProvider).value, _session);
    expect(find.byKey(const Key('email-submit')), findsNothing);
  });

  testWidgets('wrong password shows a localized inline error and keeps the sheet open', (tester) async {
    when(() => repo.signInWithEmail(email: any(named: 'email'), password: any(named: 'password')))
        .thenThrow(_apiError(401, 'AUTH_005'));
    await pumpLogin(tester);
    await openEmailSheet(tester);

    await tester.enterText(find.byKey(const Key('email-field')), 'reviewer@example.com');
    await tester.enterText(find.byKey(const Key('password-field')), 'wrong');
    await tester.tap(find.byKey(const Key('email-submit')));
    await tester.pumpAndSettle();

    expect(find.text('Incorrect email or password.'), findsOneWidget);
    expect(find.byKey(const Key('email-submit')), findsOneWidget);
    expect(container.read(authStateProvider).value, isNull);
    expect(find.byType(AlertDialog), findsNothing, reason: 'email errors stay inline');
  });

  testWidgets('invalid input is caught before any request', (tester) async {
    await pumpLogin(tester);
    await openEmailSheet(tester);

    await tester.enterText(find.byKey(const Key('email-field')), 'not-an-email');
    await tester.tap(find.byKey(const Key('email-submit')));
    await tester.pumpAndSettle();

    expect(find.text('Enter a valid email address.'), findsOneWidget);
    expect(find.text('Enter your password.'), findsOneWidget);
    verifyNever(() => repo.signInWithEmail(email: any(named: 'email'), password: any(named: 'password')));
  });

  testWidgets('sign-up enforces username and password rules, then registers', (tester) async {
    when(() => repo.registerWithEmail(
          email: any(named: 'email'),
          username: any(named: 'username'),
          password: any(named: 'password'),
        )).thenAnswer((_) async => _session);
    await pumpLogin(tester);
    await openEmailSheet(tester);
    await tester.tap(find.text('No account? Create one'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('email-field')), 'new@example.com');
    await tester.enterText(find.byKey(const Key('username-field')), 'x');
    await tester.enterText(find.byKey(const Key('password-field')), 'weakpass');
    await tester.tap(find.byKey(const Key('email-submit')));
    await tester.pumpAndSettle();
    verifyNever(() => repo.registerWithEmail(
          email: any(named: 'email'),
          username: any(named: 'username'),
          password: any(named: 'password'),
        ));

    await tester.enterText(find.byKey(const Key('username-field')), 'new_user');
    await tester.enterText(find.byKey(const Key('password-field')), 'Passw0rd!');
    await tester.tap(find.byKey(const Key('email-submit')));
    await tester.pumpAndSettle();

    verify(() => repo.registerWithEmail(
          email: 'new@example.com',
          username: 'new_user',
          password: 'Passw0rd!',
        )).called(1);
    expect(container.read(authStateProvider).value, _session);
  });

  group('authErrorMessage', () {
    const t = ToneBridgeStrings('en');

    test('maps server codes to localized messages', () {
      expect(authErrorMessage(_apiError(409, 'USER_002'), t), contains('already in use'));
      expect(authErrorMessage(_apiError(409, 'USER_003'), t), 'This username is taken.');
      expect(authErrorMessage(_apiError(429, 'AUTH_006'), t), startsWith('Too many attempts'));
    });

    test('no response means a connection problem; anything else is generic, never raw', () {
      final offline = DioException(requestOptions: RequestOptions(path: '/x'));
      expect(authErrorMessage(offline, t), startsWith("Couldn't reach the server"));
      expect(authErrorMessage(const FormatException('boom'), t), "Couldn't sign you in. Please try again.");
    });
  });
}
