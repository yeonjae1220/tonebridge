import 'package:tonebridge/core/i18n/ui_language.dart';

/// Sign-in screen strings. Kept beside the auth feature instead of growing
/// `ui_language.dart`; same 9 languages and Korean fallback.
extension AuthStrings on ToneBridgeStrings {
  String _auth(Map<String, String> values) => values[language] ?? values['ko']!;

  String get continueWithApple => _auth({
    'ko': 'Apple로 계속하기',
    'en': 'Continue with Apple',
    'ja': 'Appleで続ける',
    'zh': '通过 Apple 继续',
    'es': 'Continuar con Apple',
    'fr': 'Continuer avec Apple',
    'de': 'Mit Apple fortfahren',
    'pt': 'Continuar com a Apple',
    'ru': 'Продолжить с Apple',
  });

  String get continueWithGoogle => _auth({
    'ko': 'Google로 계속하기',
    'en': 'Continue with Google',
    'ja': 'Googleで続ける',
    'zh': '通过 Google 继续',
    'es': 'Continuar con Google',
    'fr': 'Continuer avec Google',
    'de': 'Mit Google fortfahren',
    'pt': 'Continuar com o Google',
    'ru': 'Продолжить с Google',
  });

  String get continueWithEmail => _auth({
    'ko': '이메일로 계속하기',
    'en': 'Continue with email',
    'ja': 'メールで続ける',
    'zh': '通过邮箱继续',
    'es': 'Continuar con correo',
    'fr': 'Continuer avec un e-mail',
    'de': 'Mit E-Mail fortfahren',
    'pt': 'Continuar com e-mail',
    'ru': 'Продолжить с эл. почтой',
  });

  String get signingIn => _auth({
    'ko': '로그인 중...',
    'en': 'Signing in...',
    'ja': 'ログイン中...',
    'zh': '正在登录...',
    'es': 'Iniciando sesión...',
    'fr': 'Connexion...',
    'de': 'Anmeldung...',
    'pt': 'Entrando...',
    'ru': 'Вход...',
  });

  /// `{terms}` and `{privacy}` are replaced by tappable links.
  String get agreeToTermsTemplate => _auth({
    'ko': '계속하면 {terms} 및 {privacy}에 동의합니다.',
    'en': 'By continuing, you agree to the {terms} and {privacy}.',
    'ja': '続行すると、{terms}と{privacy}に同意したことになります。',
    'zh': '继续即表示您同意{terms}和{privacy}。',
    'es': 'Al continuar, aceptas los {terms} y la {privacy}.',
    'fr': 'En continuant, vous acceptez les {terms} et la {privacy}.',
    'de': 'Wenn du fortfährst, stimmst du den {terms} und der {privacy} zu.',
    'pt': 'Ao continuar, você concorda com os {terms} e a {privacy}.',
    'ru': 'Продолжая, вы соглашаетесь с {terms} и {privacy}.',
  });

  String get termsOfService => _auth({
    'ko': '이용약관',
    'en': 'Terms of Service',
    'ja': '利用規約',
    'zh': '服务条款',
    'es': 'Términos del servicio',
    'fr': "Conditions d'utilisation",
    'de': 'Nutzungsbedingungen',
    'pt': 'Termos de Serviço',
    'ru': 'Условиями использования',
  });

  String get privacyPolicy => _auth({
    'ko': '개인정보 처리방침',
    'en': 'Privacy Policy',
    'ja': 'プライバシーポリシー',
    'zh': '隐私政策',
    'es': 'Política de privacidad',
    'fr': 'Politique de confidentialité',
    'de': 'Datenschutzerklärung',
    'pt': 'Política de Privacidade',
    'ru': 'Политикой конфиденциальности',
  });

  String get signInErrorTitle => _auth({
    'ko': '로그인 오류',
    'en': 'Sign-in error',
    'ja': 'ログインエラー',
    'zh': '登录错误',
    'es': 'Error al iniciar sesión',
    'fr': 'Erreur de connexion',
    'de': 'Anmeldefehler',
    'pt': 'Erro ao entrar',
    'ru': 'Ошибка входа',
  });

  String get okAction => _auth({
    'ko': '확인',
    'en': 'OK',
    'ja': 'OK',
    'zh': '确定',
    'es': 'Aceptar',
    'fr': 'OK',
    'de': 'OK',
    'pt': 'OK',
    'ru': 'ОК',
  });

  String get emailSignInTitle => _auth({
    'ko': '이메일로 로그인',
    'en': 'Sign in with email',
    'ja': 'メールでログイン',
    'zh': '邮箱登录',
    'es': 'Iniciar sesión con correo',
    'fr': 'Connexion par e-mail',
    'de': 'Mit E-Mail anmelden',
    'pt': 'Entrar com e-mail',
    'ru': 'Вход по эл. почте',
  });

  String get emailSignUpTitle => _auth({
    'ko': '이메일로 가입',
    'en': 'Sign up with email',
    'ja': 'メールで登録',
    'zh': '邮箱注册',
    'es': 'Registrarse con correo',
    'fr': 'Inscription par e-mail',
    'de': 'Mit E-Mail registrieren',
    'pt': 'Cadastrar com e-mail',
    'ru': 'Регистрация по эл. почте',
  });

  String get emailLabel => _auth({
    'ko': '이메일',
    'en': 'Email',
    'ja': 'メールアドレス',
    'zh': '邮箱',
    'es': 'Correo electrónico',
    'fr': 'E-mail',
    'de': 'E-Mail',
    'pt': 'E-mail',
    'ru': 'Эл. почта',
  });

  String get passwordLabel => _auth({
    'ko': '비밀번호',
    'en': 'Password',
    'ja': 'パスワード',
    'zh': '密码',
    'es': 'Contraseña',
    'fr': 'Mot de passe',
    'de': 'Passwort',
    'pt': 'Senha',
    'ru': 'Пароль',
  });

  String get usernameLabel => _auth({
    'ko': '닉네임',
    'en': 'Username',
    'ja': 'ユーザー名',
    'zh': '用户名',
    'es': 'Nombre de usuario',
    'fr': "Nom d'utilisateur",
    'de': 'Benutzername',
    'pt': 'Nome de usuário',
    'ru': 'Имя пользователя',
  });

  String get usernameRule => _auth({
    'ko': '2~20자 영문, 숫자, 밑줄(_)',
    'en': '2–20 letters, numbers or underscores',
    'ja': '2〜20文字の英数字とアンダースコア(_)',
    'zh': '2–20 个字母、数字或下划线',
    'es': '2–20 letras, números o guiones bajos',
    'fr': '2 à 20 lettres, chiffres ou tirets bas',
    'de': '2–20 Buchstaben, Ziffern oder Unterstriche',
    'pt': '2–20 letras, números ou sublinhados',
    'ru': '2–20 латинских букв, цифр или _',
  });

  String get passwordRule => _auth({
    'ko': '8자 이상, 대문자·소문자·숫자·특수문자 포함',
    'en': '8+ characters with upper and lower case, a number and a symbol',
    'ja': '8文字以上、大文字・小文字・数字・記号を含む',
    'zh': '至少 8 位，包含大小写字母、数字和符号',
    'es': '8+ caracteres con mayúscula, minúscula, número y símbolo',
    'fr': '8 caractères min. avec majuscule, minuscule, chiffre et symbole',
    'de': 'Mind. 8 Zeichen mit Groß-, Kleinbuchstaben, Ziffer und Sonderzeichen',
    'pt': '8+ caracteres com maiúscula, minúscula, número e símbolo',
    'ru': 'От 8 символов: заглавная, строчная, цифра и символ',
  });

  String get signInAction => _auth({
    'ko': '로그인',
    'en': 'Sign in',
    'ja': 'ログイン',
    'zh': '登录',
    'es': 'Iniciar sesión',
    'fr': 'Se connecter',
    'de': 'Anmelden',
    'pt': 'Entrar',
    'ru': 'Войти',
  });

  String get signUpAction => _auth({
    'ko': '가입하기',
    'en': 'Create account',
    'ja': '登録する',
    'zh': '创建账号',
    'es': 'Crear cuenta',
    'fr': 'Créer un compte',
    'de': 'Konto erstellen',
    'pt': 'Criar conta',
    'ru': 'Создать аккаунт',
  });

  String get switchToSignUp => _auth({
    'ko': '계정이 없나요? 가입하기',
    'en': "No account? Create one",
    'ja': 'アカウントがない場合は登録',
    'zh': '没有账号？立即注册',
    'es': '¿No tienes cuenta? Regístrate',
    'fr': 'Pas de compte ? Inscrivez-vous',
    'de': 'Kein Konto? Registrieren',
    'pt': 'Não tem conta? Cadastre-se',
    'ru': 'Нет аккаунта? Зарегистрироваться',
  });

  String get switchToSignIn => _auth({
    'ko': '이미 계정이 있나요? 로그인',
    'en': 'Already have an account? Sign in',
    'ja': 'アカウントをお持ちの場合はログイン',
    'zh': '已有账号？登录',
    'es': '¿Ya tienes cuenta? Inicia sesión',
    'fr': 'Déjà un compte ? Connectez-vous',
    'de': 'Schon ein Konto? Anmelden',
    'pt': 'Já tem conta? Entrar',
    'ru': 'Уже есть аккаунт? Войти',
  });

  String get forgotPassword => _auth({
    'ko': '비밀번호를 잊으셨나요?',
    'en': 'Forgot password?',
    'ja': 'パスワードをお忘れですか？',
    'zh': '忘记密码？',
    'es': '¿Olvidaste tu contraseña?',
    'fr': 'Mot de passe oublié ?',
    'de': 'Passwort vergessen?',
    'pt': 'Esqueceu a senha?',
    'ru': 'Забыли пароль?',
  });

  String get invalidEmail => _auth({
    'ko': '올바른 이메일 주소를 입력하세요.',
    'en': 'Enter a valid email address.',
    'ja': '正しいメールアドレスを入力してください。',
    'zh': '请输入有效的邮箱地址。',
    'es': 'Introduce un correo válido.',
    'fr': 'Saisissez une adresse e-mail valide.',
    'de': 'Gib eine gültige E-Mail-Adresse ein.',
    'pt': 'Digite um e-mail válido.',
    'ru': 'Введите корректный адрес эл. почты.',
  });

  String get passwordRequired => _auth({
    'ko': '비밀번호를 입력하세요.',
    'en': 'Enter your password.',
    'ja': 'パスワードを入力してください。',
    'zh': '请输入密码。',
    'es': 'Introduce tu contraseña.',
    'fr': 'Saisissez votre mot de passe.',
    'de': 'Gib dein Passwort ein.',
    'pt': 'Digite sua senha.',
    'ru': 'Введите пароль.',
  });

  String get loginFailed => _auth({
    'ko': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'en': 'Incorrect email or password.',
    'ja': 'メールアドレスまたはパスワードが正しくありません。',
    'zh': '邮箱或密码不正确。',
    'es': 'Correo o contraseña incorrectos.',
    'fr': 'E-mail ou mot de passe incorrect.',
    'de': 'E-Mail oder Passwort ist falsch.',
    'pt': 'E-mail ou senha incorretos.',
    'ru': 'Неверная эл. почта или пароль.',
  });

  String get emailTaken => _auth({
    'ko': '이미 사용 중인 이메일입니다. 로그인하거나 다른 방법으로 계속하세요.',
    'en': 'This email is already in use. Sign in or continue another way.',
    'ja': 'このメールアドレスは使用中です。ログインするか別の方法で続けてください。',
    'zh': '该邮箱已被使用。请登录或使用其他方式继续。',
    'es': 'Este correo ya está en uso. Inicia sesión o continúa de otra forma.',
    'fr': 'Cet e-mail est déjà utilisé. Connectez-vous ou continuez autrement.',
    'de': 'Diese E-Mail wird bereits verwendet. Melde dich an oder fahre anders fort.',
    'pt': 'Este e-mail já está em uso. Entre ou continue de outra forma.',
    'ru': 'Этот адрес уже используется. Войдите или выберите другой способ.',
  });

  String get usernameTaken => _auth({
    'ko': '이미 사용 중인 닉네임입니다.',
    'en': 'This username is taken.',
    'ja': 'このユーザー名は使用中です。',
    'zh': '该用户名已被占用。',
    'es': 'Este nombre de usuario ya existe.',
    'fr': "Ce nom d'utilisateur est déjà pris.",
    'de': 'Dieser Benutzername ist vergeben.',
    'pt': 'Este nome de usuário já existe.',
    'ru': 'Это имя пользователя занято.',
  });

  String get tooManyAttempts => _auth({
    'ko': '시도가 너무 많습니다. 잠시 후 다시 시도하세요.',
    'en': 'Too many attempts. Try again in a moment.',
    'ja': '試行回数が多すぎます。しばらくしてから再試行してください。',
    'zh': '尝试次数过多，请稍后再试。',
    'es': 'Demasiados intentos. Inténtalo de nuevo en un momento.',
    'fr': 'Trop de tentatives. Réessayez dans un instant.',
    'de': 'Zu viele Versuche. Versuche es gleich noch einmal.',
    'pt': 'Muitas tentativas. Tente novamente em instantes.',
    'ru': 'Слишком много попыток. Повторите позже.',
  });

  String get networkErrorRetry => _auth({
    'ko': '서버에 연결하지 못했습니다. 연결을 확인하고 다시 시도하세요.',
    'en': "Couldn't reach the server. Check your connection and try again.",
    'ja': 'サーバーに接続できませんでした。接続を確認して再試行してください。',
    'zh': '无法连接服务器。请检查网络后重试。',
    'es': 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    'fr': 'Serveur injoignable. Vérifiez votre connexion et réessayez.',
    'de': 'Server nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.',
    'pt': 'Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.',
    'ru': 'Не удалось связаться с сервером. Проверьте подключение и повторите.',
  });

  String get unexpectedSignInError => _auth({
    'ko': '로그인하지 못했습니다. 다시 시도하세요.',
    'en': "Couldn't sign you in. Please try again.",
    'ja': 'ログインできませんでした。もう一度お試しください。',
    'zh': '登录失败，请重试。',
    'es': 'No se pudo iniciar sesión. Inténtalo de nuevo.',
    'fr': 'Connexion impossible. Veuillez réessayer.',
    'de': 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.',
    'pt': 'Não foi possível entrar. Tente novamente.',
    'ru': 'Не удалось войти. Попробуйте снова.',
  });
}
