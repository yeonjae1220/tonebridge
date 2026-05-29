import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tonebridge/features/auth/presentation/auth_provider.dart';

const supportedUiLanguages = [
  'ko',
  'en',
  'ja',
  'zh',
  'es',
  'fr',
  'de',
  'pt',
  'ru',
];

typedef UiLanguageEntry = ({String code, String label, String flag});

const uiLanguageOptions = <UiLanguageEntry>[
  (code: 'ko', label: '한국어', flag: '🇰🇷'),
  (code: 'en', label: 'English', flag: '🇺🇸'),
  (code: 'ja', label: '日本語', flag: '🇯🇵'),
  (code: 'zh', label: '中文', flag: '🇨🇳'),
  (code: 'es', label: 'Español', flag: '🇪🇸'),
  (code: 'fr', label: 'Français', flag: '🇫🇷'),
  (code: 'de', label: 'Deutsch', flag: '🇩🇪'),
  (code: 'pt', label: 'Português', flag: '🇵🇹'),
  (code: 'ru', label: 'Русский', flag: '🇷🇺'),
];

String normalizeUiLanguage(String? code) {
  return supportedUiLanguages.contains(code) ? code! : 'ko';
}

final uiLanguageProvider = Provider<String>((ref) {
  final session = ref.watch(authStateProvider).value;
  return normalizeUiLanguage(session?.user.uiLanguage);
});

final tProvider = Provider<ToneBridgeStrings>((ref) {
  return ToneBridgeStrings(ref.watch(uiLanguageProvider));
});

class ToneBridgeStrings {
  const ToneBridgeStrings(this.language);

  final String language;

  String get settings => _pick({
    'ko': '설정',
    'en': 'Settings',
    'ja': '設定',
    'zh': '设置',
    'es': 'Ajustes',
    'fr': 'Paramètres',
    'de': 'Einstellungen',
    'pt': 'Configurações',
    'ru': 'Настройки',
  });

  String get uiLanguage => _pick({
    'ko': 'UI 언어',
    'en': 'UI language',
    'ja': 'UI言語',
    'zh': '界面语言',
    'es': 'Idioma de la interfaz',
    'fr': "Langue de l'interface",
    'de': 'UI-Sprache',
    'pt': 'Idioma da interface',
    'ru': 'Язык интерфейса',
  });

  String get uiLanguageSubtitle => _pick({
    'ko': '앱 화면에 표시되는 언어입니다',
    'en': 'Language used across the app',
    'ja': 'アプリに表示される言語',
    'zh': '应用中显示的语言',
    'es': 'Idioma usado en la app',
    'fr': "Langue affichée dans l'application",
    'de': 'Sprache der App-Oberfläche',
    'pt': 'Idioma exibido no aplicativo',
    'ru': 'Язык, используемый в приложении',
  });

  String get account => _pick({
    'ko': '계정',
    'en': 'Account',
    'ja': 'アカウント',
    'zh': '账户',
    'es': 'Cuenta',
    'fr': 'Compte',
    'de': 'Konto',
    'pt': 'Conta',
    'ru': 'Аккаунт',
  });

  String get logout => _pick({
    'ko': '로그아웃',
    'en': 'Log out',
    'ja': 'ログアウト',
    'zh': '退出登录',
    'es': 'Cerrar sesión',
    'fr': 'Se déconnecter',
    'de': 'Abmelden',
    'pt': 'Sair',
    'ru': 'Выйти',
  });

  String get deleteAccount => _pick({
    'ko': '회원탈퇴',
    'en': 'Delete account',
    'ja': '退会',
    'zh': '删除账户',
    'es': 'Eliminar cuenta',
    'fr': 'Supprimer le compte',
    'de': 'Konto löschen',
    'pt': 'Excluir conta',
    'ru': 'Удалить аккаунт',
  });

  String get logoutSubtitle => _pick({
    'ko': '이 기기에서만 로그아웃합니다',
    'en': 'Log out on this device only',
    'ja': 'この端末からのみログアウトします',
    'zh': '仅从此设备退出登录',
    'es': 'Cerrar sesión solo en este dispositivo',
    'fr': 'Se déconnecter uniquement sur cet appareil',
    'de': 'Nur auf diesem Gerät abmelden',
    'pt': 'Sair apenas deste dispositivo',
    'ru': 'Выйти только на этом устройстве',
  });

  String get deleteAccountSubtitle => _pick({
    'ko': '두 번 확인 후 계정을 삭제합니다',
    'en': 'Delete the account after two confirmations',
    'ja': '2回確認してからアカウントを削除します',
    'zh': '两次确认后删除账户',
    'es': 'Eliminar la cuenta tras dos confirmaciones',
    'fr': 'Supprimer le compte après deux confirmations',
    'de': 'Konto nach zwei Bestätigungen löschen',
    'pt': 'Excluir a conta após duas confirmações',
    'ru': 'Удалить аккаунт после двух подтверждений',
  });

  String get cancel => _pick({
    'ko': '취소',
    'en': 'Cancel',
    'ja': 'キャンセル',
    'zh': '取消',
    'es': 'Cancelar',
    'fr': 'Annuler',
    'de': 'Abbrechen',
    'pt': 'Cancelar',
    'ru': 'Отмена',
  });

  String get continueAction => _pick({
    'ko': '계속',
    'en': 'Continue',
    'ja': '続ける',
    'zh': '继续',
    'es': 'Continuar',
    'fr': 'Continuer',
    'de': 'Weiter',
    'pt': 'Continuar',
    'ru': 'Продолжить',
  });

  String get signOutConfirm => _pick({
    'ko': '현재 계정에서 로그아웃할까요?',
    'en': 'Log out of the current account?',
    'ja': '現在のアカウントからログアウトしますか？',
    'zh': '要退出当前账户吗？',
    'es': '¿Cerrar sesión en la cuenta actual?',
    'fr': 'Se déconnecter du compte actuel ?',
    'de': 'Vom aktuellen Konto abmelden?',
    'pt': 'Sair da conta atual?',
    'ru': 'Выйти из текущего аккаунта?',
  });

  String get deleteAccountConfirm => _pick({
    'ko': '탈퇴하면 요청, 첨삭, 스터디 기록이 삭제되며 복구할 수 없습니다.',
    'en':
        'Deleting your account removes requests, corrections, and study history permanently.',
    'ja': '退会すると依頼、添削、学習履歴が削除され、復元できません。',
    'zh': '删除账户后，请求、批改和学习记录将被永久删除。',
    'es':
        'Al eliminar la cuenta se borran solicitudes, correcciones e historial de estudio de forma permanente.',
    'fr':
        'La suppression du compte efface définitivement les demandes, corrections et historiques d’étude.',
    'de':
        'Beim Löschen des Kontos werden Anfragen, Korrekturen und Lernverlauf dauerhaft gelöscht.',
    'pt':
        'Ao excluir a conta, solicitações, correções e histórico de estudo serão removidos permanentemente.',
    'ru':
        'При удалении аккаунта запросы, правки и история учебы будут удалены без восстановления.',
  });

  String get deleteAccountSecondTitle => _pick({
    'ko': '정말 탈퇴할까요?',
    'en': 'Really delete your account?',
    'ja': '本当に退会しますか？',
    'zh': '确定要删除账户吗？',
    'es': '¿Eliminar la cuenta definitivamente?',
    'fr': 'Supprimer vraiment le compte ?',
    'de': 'Konto wirklich löschen?',
    'pt': 'Excluir a conta mesmo?',
    'ru': 'Точно удалить аккаунт?',
  });

  String get deleteAccountSecondConfirm => _pick({
    'ko': '이 작업은 되돌릴 수 없습니다.',
    'en': 'This action cannot be undone.',
    'ja': 'この操作は元に戻せません。',
    'zh': '此操作无法撤销。',
    'es': 'Esta acción no se puede deshacer.',
    'fr': 'Cette action est irréversible.',
    'de': 'Diese Aktion kann nicht rückgängig gemacht werden.',
    'pt': 'Esta ação não pode ser desfeita.',
    'ru': 'Это действие нельзя отменить.',
  });

  String get deleteAccountFailed => _pick({
    'ko': '회원탈퇴에 실패했습니다. 다시 시도해주세요.',
    'en': 'Could not delete your account. Please try again.',
    'ja': '退会に失敗しました。もう一度お試しください。',
    'zh': '删除账户失败。请重试。',
    'es': 'No se pudo eliminar la cuenta. Inténtalo de nuevo.',
    'fr': 'Impossible de supprimer le compte. Réessayez.',
    'de': 'Konto konnte nicht gelöscht werden. Bitte erneut versuchen.',
    'pt': 'Não foi possível excluir a conta. Tente novamente.',
    'ru': 'Не удалось удалить аккаунт. Попробуйте снова.',
  });

  String get save => _pick({
    'ko': '저장',
    'en': 'Save',
    'ja': '保存',
    'zh': '保存',
    'es': 'Guardar',
    'fr': 'Enregistrer',
    'de': 'Speichern',
    'pt': 'Salvar',
    'ru': 'Сохранить',
  });

  String get edit => _pick({
    'ko': '수정',
    'en': 'Edit',
    'ja': '編集',
    'zh': '编辑',
    'es': 'Editar',
    'fr': 'Modifier',
    'de': 'Bearbeiten',
    'pt': 'Editar',
    'ru': 'Изменить',
  });

  String get delete => _pick({
    'ko': '삭제',
    'en': 'Delete',
    'ja': '削除',
    'zh': '删除',
    'es': 'Eliminar',
    'fr': 'Supprimer',
    'de': 'Löschen',
    'pt': 'Excluir',
    'ru': 'Удалить',
  });

  String get retry => _pick({
    'ko': '다시 시도',
    'en': 'Try again',
    'ja': '再試行',
    'zh': '重试',
    'es': 'Reintentar',
    'fr': 'Réessayer',
    'de': 'Erneut versuchen',
    'pt': 'Tentar novamente',
    'ru': 'Повторить',
  });

  String get play => _pick({
    'ko': '재생',
    'en': 'Play',
    'ja': '再生',
    'zh': '播放',
    'es': 'Reproducir',
    'fr': 'Lire',
    'de': 'Abspielen',
    'pt': 'Reproduzir',
    'ru': 'Воспроизвести',
  });

  String get pause => _pick({
    'ko': '일시정지',
    'en': 'Pause',
    'ja': '一時停止',
    'zh': '暂停',
    'es': 'Pausar',
    'fr': 'Pause',
    'de': 'Pause',
    'pt': 'Pausar',
    'ru': 'Пауза',
  });

  String get audio => _pick({
    'ko': '음성',
    'en': 'Audio',
    'ja': '音声',
    'zh': '语音',
    'es': 'Audio',
    'fr': 'Audio',
    'de': 'Audio',
    'pt': 'Áudio',
    'ru': 'Аудио',
  });

  String get text => _pick({
    'ko': '텍스트',
    'en': 'Text',
    'ja': 'テキスト',
    'zh': '文本',
    'es': 'Texto',
    'fr': 'Texte',
    'de': 'Text',
    'pt': 'Texto',
    'ru': 'Текст',
  });

  String get genericError => _pick({
    'ko': '오류가 발생했어요. 다시 시도해 주세요.',
    'en': 'Something went wrong. Please try again.',
    'ja': 'エラーが発生しました。もう一度お試しください。',
    'zh': '出现错误。请重试。',
    'es': 'Ocurrió un error. Inténtalo de nuevo.',
    'fr': 'Une erreur est survenue. Réessayez.',
    'de': 'Ein Fehler ist aufgetreten. Bitte erneut versuchen.',
    'pt': 'Ocorreu um erro. Tente novamente.',
    'ru': 'Произошла ошибка. Попробуйте снова.',
  });

  String get errorOccurred => _pick({
    'ko': '오류가 발생했습니다',
    'en': 'Something went wrong',
    'ja': 'エラーが発生しました',
    'zh': '出现错误',
    'es': 'Ocurrió un error',
    'fr': 'Une erreur est survenue',
    'de': 'Ein Fehler ist aufgetreten',
    'pt': 'Ocorreu um erro',
    'ru': 'Произошла ошибка',
  });

  String errorWithDetail(Object error) => _format(
    _pick({
      'ko': '오류: {error}',
      'en': 'Error: {error}',
      'ja': 'エラー: {error}',
      'zh': '错误：{error}',
      'es': 'Error: {error}',
      'fr': 'Erreur : {error}',
      'de': 'Fehler: {error}',
      'pt': 'Erro: {error}',
      'ru': 'Ошибка: {error}',
    }),
    {'error': error.toString()},
  );

  String editFailed(Object error) => _format(
    _pick({
      'ko': '수정 실패: {error}',
      'en': 'Could not save changes: {error}',
      'ja': '修正に失敗しました: {error}',
      'zh': '修改失败：{error}',
      'es': 'No se pudieron guardar los cambios: {error}',
      'fr': 'Impossible d’enregistrer les modifications : {error}',
      'de': 'Änderungen konnten nicht gespeichert werden: {error}',
      'pt': 'Não foi possível salvar as alterações: {error}',
      'ru': 'Не удалось сохранить изменения: {error}',
    }),
    {'error': error.toString()},
  );

  String deleteFailed(Object error) => _format(
    _pick({
      'ko': '삭제 실패: {error}',
      'en': 'Could not delete: {error}',
      'ja': '削除に失敗しました: {error}',
      'zh': '删除失败：{error}',
      'es': 'No se pudo eliminar: {error}',
      'fr': 'Impossible de supprimer : {error}',
      'de': 'Löschen fehlgeschlagen: {error}',
      'pt': 'Não foi possível excluir: {error}',
      'ru': 'Не удалось удалить: {error}',
    }),
    {'error': error.toString()},
  );

  String playFailed(Object error) => _format(
    _pick({
      'ko': '재생 실패: {error}',
      'en': 'Could not play audio: {error}',
      'ja': '再生に失敗しました: {error}',
      'zh': '播放失败：{error}',
      'es': 'No se pudo reproducir: {error}',
      'fr': 'Lecture impossible : {error}',
      'de': 'Wiedergabe fehlgeschlagen: {error}',
      'pt': 'Não foi possível reproduzir: {error}',
      'ru': 'Не удалось воспроизвести: {error}',
    }),
    {'error': error.toString()},
  );

  String get feedTitle => _pick({
    'ko': '첨삭하기',
    'en': 'Feed',
    'ja': 'フィード',
    'zh': '动态',
    'es': 'Feed',
    'fr': 'Fil',
    'de': 'Feed',
    'pt': 'Feed',
    'ru': 'Лента',
  });

  String get requestAction => _pick({
    'ko': '내 문장 요청',
    'en': 'Request',
    'ja': '依頼する',
    'zh': '发起请求',
    'es': 'Solicitar',
    'fr': 'Demander',
    'de': 'Anfragen',
    'pt': 'Pedir',
    'ru': 'Запросить',
  });

  String get correctionRequests => _pick({
    'ko': '도와줄 요청',
    'en': 'Correction requests',
    'ja': '添削依頼',
    'zh': '批改请求',
    'es': 'Solicitudes',
    'fr': 'Demandes',
    'de': 'Korrekturanfragen',
    'pt': 'Solicitações',
    'ru': 'Запросы',
  });

  String get myRequests => _pick({
    'ko': '내 요청',
    'en': 'My requests',
    'ja': '自分の依頼',
    'zh': '我的请求',
    'es': 'Mis solicitudes',
    'fr': 'Mes demandes',
    'de': 'Meine Anfragen',
    'pt': 'Meus pedidos',
    'ru': 'Мои запросы',
  });

  String get noCorrectableRequests => _pick({
    'ko': '교정 가능한 요청이 없습니다.\n잠시 후 다시 확인해보세요.',
    'en': 'No requests you can correct yet.\nCheck again later.',
    'ja': '添削できる依頼はまだありません。\nあとで確認してください。',
    'zh': '还没有可批改的请求。\n稍后再查看。',
    'es': 'Aún no hay solicitudes para corregir.\nVuelve más tarde.',
    'fr': 'Aucune demande à corriger pour le moment.\nRevenez plus tard.',
    'de': 'Noch keine passenden Anfragen.\nSchau später wieder vorbei.',
    'pt': 'Ainda não há pedidos para corrigir.\nVerifique mais tarde.',
    'ru': 'Пока нет запросов для проверки.\nЗагляните позже.',
  });

  String get noMyRequests => _pick({
    'ko': '아직 교정 요청이 없습니다.\n새 요청을 작성해보세요.',
    'en': 'No correction requests yet.\nCreate a new request.',
    'ja': '添削依頼はまだありません。\n新しい依頼を作成しましょう。',
    'zh': '还没有批改请求。\n创建一个新请求吧。',
    'es': 'Aún no tienes solicitudes.\nCrea una nueva.',
    'fr': 'Vous n’avez pas encore de demande.\nCréez-en une.',
    'de': 'Noch keine Korrekturanfragen.\nErstelle eine neue Anfrage.',
    'pt': 'Ainda não há pedidos.\nCrie um novo pedido.',
    'ru': 'Запросов пока нет.\nСоздайте новый.',
  });

  String streakDays(int count) => _format(
    _pick({
      'ko': '{count}일',
      'en': '{count}d',
      'ja': '{count}日',
      'zh': '{count}天',
      'es': '{count} d',
      'fr': '{count} j',
      'de': '{count} T',
      'pt': '{count} d',
      'ru': '{count} дн.',
    }),
    {'count': count.toString()},
  );

  String get audioCorrectionRequest => _pick({
    'ko': '음성 교정 요청',
    'en': 'Audio correction request',
    'ja': '音声添削依頼',
    'zh': '语音批改请求',
    'es': 'Solicitud de audio',
    'fr': 'Demande audio',
    'de': 'Audio-Korrekturanfrage',
    'pt': 'Pedido de correção de áudio',
    'ru': 'Запрос проверки аудио',
  });

  String get feedSubtitle => _pick({
    'ko': '내가 도와줄 수 있는 요청을 고르고 크레딧을 받아요',
    'en': 'Pick requests you can help with and earn credits',
    'ja': '手伝える依頼を選んでクレジットを獲得しましょう',
    'zh': '选择你能帮助的请求并获得积分',
    'es': 'Elige solicitudes que puedas ayudar y gana créditos',
    'fr': 'Choisissez des demandes à aider et gagnez des crédits',
    'de': 'Wähle Anfragen, bei denen du helfen kannst, und verdiene Credits',
    'pt': 'Escolha pedidos em que pode ajudar e ganhe créditos',
    'ru': 'Выбирайте запросы, где можете помочь, и получайте кредиты',
  });

  String get requestTitle => _pick({
    'ko': '첨삭 요청',
    'en': 'Request correction',
    'ja': '添削を依頼',
    'zh': '请求批改',
    'es': 'Pedir corrección',
    'fr': 'Demander une correction',
    'de': 'Korrektur anfragen',
    'pt': 'Pedir correção',
    'ru': 'Запросить проверку',
  });

  String get requestSubtitle => _pick({
    'ko': '문장이나 음성을 남기면 원어민이 자연스럽게 다듬어줘요',
    'en': 'Share text or audio and native speakers will polish it',
    'ja': '文章や音声を送るとネイティブが自然に整えます',
    'zh': '留下文字或语音，母语者会帮你润色',
    'es': 'Comparte texto o audio y un nativo lo pulirá',
    'fr': 'Partagez texte ou audio, un natif l’améliorera',
    'de': 'Teile Text oder Audio und Muttersprachler verbessern es',
    'pt': 'Envie texto ou áudio e nativos vão ajustar',
    'ru': 'Отправьте текст или аудио, носители помогут улучшить',
  });

  String get requestTypeQuestion => _pick({
    'ko': '무엇을 첨삭받을까요?',
    'en': 'What do you want corrected?',
    'ja': '何を添削してもらいますか？',
    'zh': '想批改什么？',
    'es': '¿Qué quieres corregir?',
    'fr': 'Que voulez-vous corriger ?',
    'de': 'Was möchtest du korrigieren lassen?',
    'pt': 'O que quer corrigir?',
    'ru': 'Что нужно проверить?',
  });

  String get correctionLanguage => _pick({
    'ko': '첨삭받을 언어',
    'en': 'Language to correct',
    'ja': '添削してほしい言語',
    'zh': '要批改的语言',
    'es': 'Idioma a corregir',
    'fr': 'Langue à corriger',
    'de': 'Sprache für die Korrektur',
    'pt': 'Idioma para corrigir',
    'ru': 'Язык проверки',
  });

  String get requestContentLabel => _pick({
    'ko': '교정받을 내용',
    'en': 'Text to correct',
    'ja': '添削してほしい内容',
    'zh': '要批改的内容',
    'es': 'Texto a corregir',
    'fr': 'Texte à corriger',
    'de': 'Text zur Korrektur',
    'pt': 'Texto para corrigir',
    'ru': 'Текст для проверки',
  });

  String get requestContentPlaceholder => _pick({
    'ko': '교정받고 싶은 문장을 입력하세요',
    'en': 'Enter the sentence you want corrected',
    'ja': '添削してほしい文を入力してください',
    'zh': '输入想批改的句子',
    'es': 'Escribe la frase que quieres corregir',
    'fr': 'Saisissez la phrase à corriger',
    'de': 'Gib den Satz ein, der korrigiert werden soll',
    'pt': 'Digite a frase que quer corrigir',
    'ru': 'Введите предложение для проверки',
  });

  String get requestContentRequired => _pick({
    'ko': '내용을 입력해주세요',
    'en': 'Please enter some text',
    'ja': '内容を入力してください',
    'zh': '请输入内容',
    'es': 'Introduce el contenido',
    'fr': 'Veuillez saisir un contenu',
    'de': 'Bitte Text eingeben',
    'pt': 'Digite o conteúdo',
    'ru': 'Введите текст',
  });

  String get requestTextContextHint => _pick({
    'ko': '문맥 (선택) - 예: 일본 회사에 이메일을 보낼 때...',
    'en': 'Context (optional) - e.g. emailing a Japanese company...',
    'ja': '文脈（任意）- 例: 日本の会社にメールする時...',
    'zh': '语境（可选）- 例：给日本公司发邮件时...',
    'es': 'Contexto (opcional), p. ej. un email a una empresa japonesa...',
    'fr': 'Contexte (facultatif), ex. écrire à une entreprise japonaise...',
    'de': 'Kontext (optional), z. B. E-Mail an eine japanische Firma...',
    'pt': 'Contexto (opcional), ex.: e-mail para uma empresa japonesa...',
    'ru': 'Контекст (необязательно), например письмо японской компании...',
  });

  String get requestAudioContextHint => _pick({
    'ko': '문맥 (선택) - 예: 일본 친구에게 전화할 때...',
    'en': 'Context (optional) - e.g. calling a Japanese friend...',
    'ja': '文脈（任意）- 例: 日本の友達に電話する時...',
    'zh': '语境（可选）- 例：给日本朋友打电话时...',
    'es': 'Contexto (opcional), p. ej. llamar a un amigo japonés...',
    'fr': 'Contexte (facultatif), ex. appeler un ami japonais...',
    'de': 'Kontext (optional), z. B. Anruf bei einem japanischen Freund...',
    'pt': 'Contexto (opcional), ex.: ligar para um amigo japonês...',
    'ru': 'Контекст (необязательно), например звонок японскому другу...',
  });

  String get audioRecording => _pick({
    'ko': '음성 녹음',
    'en': 'Audio recording',
    'ja': '音声録音',
    'zh': '语音录制',
    'es': 'Grabación de audio',
    'fr': 'Enregistrement audio',
    'de': 'Audioaufnahme',
    'pt': 'Gravação de áudio',
    'ru': 'Запись аудио',
  });

  String get feedbackGoalOptional => _pick({
    'ko': '피드백 목표 (선택)',
    'en': 'Feedback focus (optional)',
    'ja': 'フィードバック目標（任意）',
    'zh': '反馈重点（可选）',
    'es': 'Objetivo del feedback (opcional)',
    'fr': 'Objectif du retour (facultatif)',
    'de': 'Feedback-Fokus (optional)',
    'pt': 'Foco do feedback (opcional)',
    'ru': 'Фокус обратной связи (необязательно)',
  });

  String creditCost(int cost) => _format(
    _pick({
      'ko': '크레딧 {count} 차감',
      'en': '{count} credits',
      'ja': '{count}クレジット消費',
      'zh': '消耗 {count} 积分',
      'es': '{count} créditos',
      'fr': '{count} crédits',
      'de': '{count} Credits',
      'pt': '{count} créditos',
      'ru': '{count} кредитов',
    }),
    {'count': cost.toString()},
  );

  String get submitCorrectionRequest => _pick({
    'ko': '교정 요청하기',
    'en': 'Request correction',
    'ja': '添削を依頼',
    'zh': '提交批改',
    'es': 'Pedir corrección',
    'fr': 'Demander une correction',
    'de': 'Korrektur anfragen',
    'pt': 'Pedir correção',
    'ru': 'Отправить на проверку',
  });

  String get requestSubmitting => _pick({
    'ko': '요청 중...',
    'en': 'Submitting...',
    'ja': '依頼中...',
    'zh': '提交中...',
    'es': 'Enviando...',
    'fr': 'Envoi...',
    'de': 'Wird gesendet...',
    'pt': 'Enviando...',
    'ru': 'Отправка...',
  });

  String get requestSuccess => _pick({
    'ko': '교정 요청이 등록됐습니다!',
    'en': 'Correction request submitted!',
    'ja': '添削依頼を登録しました！',
    'zh': '批改请求已提交！',
    'es': '¡Solicitud enviada!',
    'fr': 'Demande envoyée !',
    'de': 'Korrekturanfrage gesendet!',
    'pt': 'Pedido enviado!',
    'ru': 'Запрос отправлен!',
  });

  String requestSubmitFailed(String detail) => _format(
    _pick({
      'ko': '교정 요청 제출에 실패했어요. {detail}',
      'en': 'Could not submit the request. {detail}',
      'ja': '添削依頼を送信できませんでした。{detail}',
      'zh': '提交批改请求失败。{detail}',
      'es': 'No se pudo enviar la solicitud. {detail}',
      'fr': 'Impossible d’envoyer la demande. {detail}',
      'de': 'Anfrage konnte nicht gesendet werden. {detail}',
      'pt': 'Não foi possível enviar o pedido. {detail}',
      'ru': 'Не удалось отправить запрос. {detail}',
    }),
    {'detail': detail},
  );

  String get loginAgain => _pick({
    'ko': '다시 로그인해 주세요.',
    'en': 'Please log in again.',
    'ja': 'もう一度ログインしてください。',
    'zh': '请重新登录。',
    'es': 'Vuelve a iniciar sesión.',
    'fr': 'Veuillez vous reconnecter.',
    'de': 'Bitte erneut anmelden.',
    'pt': 'Faça login novamente.',
    'ru': 'Войдите снова.',
  });

  String get checkRequestContent => _pick({
    'ko': '요청 내용을 확인해 주세요.',
    'en': 'Please check your request.',
    'ja': '依頼内容を確認してください。',
    'zh': '请检查请求内容。',
    'es': 'Revisa tu solicitud.',
    'fr': 'Vérifiez votre demande.',
    'de': 'Bitte prüfe deine Anfrage.',
    'pt': 'Verifique seu pedido.',
    'ru': 'Проверьте запрос.',
  });

  String get checkNetwork => _pick({
    'ko': '네트워크 상태를 확인해 주세요.',
    'en': 'Please check your network connection.',
    'ja': 'ネットワーク状態を確認してください。',
    'zh': '请检查网络连接。',
    'es': 'Comprueba tu conexión.',
    'fr': 'Vérifiez votre connexion.',
    'de': 'Bitte Netzwerkverbindung prüfen.',
    'pt': 'Verifique a conexão.',
    'ru': 'Проверьте сеть.',
  });

  String get recordAction => _pick({
    'ko': '녹음하기',
    'en': 'Record',
    'ja': '録音する',
    'zh': '录音',
    'es': 'Grabar',
    'fr': 'Enregistrer',
    'de': 'Aufnehmen',
    'pt': 'Gravar',
    'ru': 'Записать',
  });

  String get recording => _pick({
    'ko': '녹음 중',
    'en': 'Recording',
    'ja': '録音中',
    'zh': '录音中',
    'es': 'Grabando',
    'fr': 'Enregistrement',
    'de': 'Aufnahme läuft',
    'pt': 'Gravando',
    'ru': 'Запись',
  });

  String get useRecording => _pick({
    'ko': '이 녹음 사용',
    'en': 'Use this recording',
    'ja': 'この録音を使う',
    'zh': '使用这段录音',
    'es': 'Usar esta grabación',
    'fr': 'Utiliser cet enregistrement',
    'de': 'Diese Aufnahme verwenden',
    'pt': 'Usar esta gravação',
    'ru': 'Использовать запись',
  });

  String get recordAgain => _pick({
    'ko': '다시 녹음',
    'en': 'Record again',
    'ja': '録音し直す',
    'zh': '重新录音',
    'es': 'Grabar de nuevo',
    'fr': 'Réenregistrer',
    'de': 'Neu aufnehmen',
    'pt': 'Gravar novamente',
    'ru': 'Записать снова',
  });

  String get requestDeleteTitle => _pick({
    'ko': '요청 삭제',
    'en': 'Delete request',
    'ja': '依頼を削除',
    'zh': '删除请求',
    'es': 'Eliminar solicitud',
    'fr': 'Supprimer la demande',
    'de': 'Anfrage löschen',
    'pt': 'Excluir pedido',
    'ru': 'Удалить запрос',
  });

  String get requestDeleteConfirm => _pick({
    'ko': '이 첨삭 요청을 삭제할까요? 목록에서 숨겨집니다.',
    'en': 'Delete this correction request? It will be hidden from the list.',
    'ja': 'この添削依頼を削除しますか？一覧から非表示になります。',
    'zh': '要删除这个批改请求吗？它会从列表中隐藏。',
    'es': '¿Eliminar esta solicitud? Se ocultará de la lista.',
    'fr': 'Supprimer cette demande ? Elle sera masquée de la liste.',
    'de': 'Diese Anfrage löschen? Sie wird aus der Liste ausgeblendet.',
    'pt': 'Excluir este pedido? Ele será ocultado da lista.',
    'ru': 'Удалить этот запрос? Он будет скрыт из списка.',
  });

  String get requestDeleted => _pick({
    'ko': '요청을 삭제했어요',
    'en': 'Request deleted',
    'ja': '依頼を削除しました',
    'zh': '请求已删除',
    'es': 'Solicitud eliminada',
    'fr': 'Demande supprimée',
    'de': 'Anfrage gelöscht',
    'pt': 'Pedido excluído',
    'ru': 'Запрос удален',
  });

  String get requestEditTitle => _pick({
    'ko': '요청 수정',
    'en': 'Edit request',
    'ja': '依頼を編集',
    'zh': '编辑请求',
    'es': 'Editar solicitud',
    'fr': 'Modifier la demande',
    'de': 'Anfrage bearbeiten',
    'pt': 'Editar pedido',
    'ru': 'Изменить запрос',
  });

  String get originalText => _pick({
    'ko': '원문',
    'en': 'Original text',
    'ja': '原文',
    'zh': '原文',
    'es': 'Texto original',
    'fr': 'Texte original',
    'de': 'Originaltext',
    'pt': 'Texto original',
    'ru': 'Исходный текст',
  });

  String get contextDescription => _pick({
    'ko': '상황 설명',
    'en': 'Context',
    'ja': '状況説明',
    'zh': '场景说明',
    'es': 'Contexto',
    'fr': 'Contexte',
    'de': 'Kontext',
    'pt': 'Contexto',
    'ru': 'Контекст',
  });

  String get requestUpdated => _pick({
    'ko': '요청을 수정했어요',
    'en': 'Request updated',
    'ja': '依頼を更新しました',
    'zh': '请求已更新',
    'es': 'Solicitud actualizada',
    'fr': 'Demande mise à jour',
    'de': 'Anfrage aktualisiert',
    'pt': 'Pedido atualizado',
    'ru': 'Запрос обновлен',
  });

  String get resultTitle => _pick({
    'ko': '교정 결과',
    'en': 'Correction result',
    'ja': '添削結果',
    'zh': '批改结果',
    'es': 'Resultado',
    'fr': 'Résultat',
    'de': 'Korrekturergebnis',
    'pt': 'Resultado',
    'ru': 'Результат',
  });

  String get resultLoadFailed => _pick({
    'ko': '결과를 불러올 수 없습니다',
    'en': 'Could not load the result',
    'ja': '結果を読み込めません',
    'zh': '无法加载结果',
    'es': 'No se pudo cargar el resultado',
    'fr': 'Impossible de charger le résultat',
    'de': 'Ergebnis konnte nicht geladen werden',
    'pt': 'Não foi possível carregar o resultado',
    'ru': 'Не удалось загрузить результат',
  });

  String get myOriginal => _pick({
    'ko': '내 원문',
    'en': 'My original',
    'ja': '自分の原文',
    'zh': '我的原文',
    'es': 'Mi original',
    'fr': 'Mon texte original',
    'de': 'Mein Original',
    'pt': 'Meu original',
    'ru': 'Мой исходный текст',
  });

  String get correctionWaitingTitle => _pick({
    'ko': '첨삭 대기 중',
    'en': 'Waiting for correction',
    'ja': '添削待ち',
    'zh': '等待批改',
    'es': 'Esperando corrección',
    'fr': 'En attente de correction',
    'de': 'Warten auf Korrektur',
    'pt': 'Aguardando correção',
    'ru': 'Ожидание проверки',
  });

  String get correctionWaitingSubtitle => _pick({
    'ko': '원어민이 첨삭하면 알림이 옵니다',
    'en': 'You will be notified when a native speaker corrects it',
    'ja': 'ネイティブが添削すると通知が届きます',
    'zh': '母语者批改后会通知你',
    'es': 'Te avisaremos cuando un nativo lo corrija',
    'fr': 'Vous serez notifié quand un natif corrige',
    'de': 'Du wirst benachrichtigt, wenn ein Muttersprachler korrigiert',
    'pt': 'Você será avisado quando um nativo corrigir',
    'ru': 'Мы сообщим, когда носитель языка проверит',
  });

  String get correctionDeleteTitle => _pick({
    'ko': '첨삭 삭제',
    'en': 'Delete correction',
    'ja': '添削を削除',
    'zh': '删除批改',
    'es': 'Eliminar corrección',
    'fr': 'Supprimer la correction',
    'de': 'Korrektur löschen',
    'pt': 'Excluir correção',
    'ru': 'Удалить правку',
  });

  String get correctionDeleteConfirm => _pick({
    'ko': '이 첨삭을 삭제할까요? 결과 목록에서 숨겨집니다.',
    'en': 'Delete this correction? It will be hidden from the result list.',
    'ja': 'この添削を削除しますか？結果一覧から非表示になります。',
    'zh': '要删除这条批改吗？它会从结果列表中隐藏。',
    'es': '¿Eliminar esta corrección? Se ocultará de la lista.',
    'fr': 'Supprimer cette correction ? Elle sera masquée.',
    'de': 'Diese Korrektur löschen? Sie wird ausgeblendet.',
    'pt': 'Excluir esta correção? Ela será ocultada.',
    'ru': 'Удалить эту правку? Она будет скрыта.',
  });

  String get correctionDeleted => _pick({
    'ko': '첨삭을 삭제했어요',
    'en': 'Correction deleted',
    'ja': '添削を削除しました',
    'zh': '批改已删除',
    'es': 'Corrección eliminada',
    'fr': 'Correction supprimée',
    'de': 'Korrektur gelöscht',
    'pt': 'Correção excluída',
    'ru': 'Правка удалена',
  });

  String get correctionEditTitle => _pick({
    'ko': '첨삭 수정',
    'en': 'Edit correction',
    'ja': '添削を編集',
    'zh': '编辑批改',
    'es': 'Editar corrección',
    'fr': 'Modifier la correction',
    'de': 'Korrektur bearbeiten',
    'pt': 'Editar correção',
    'ru': 'Изменить правку',
  });

  String get correctedSentence => _pick({
    'ko': '수정 문장',
    'en': 'Corrected sentence',
    'ja': '修正文',
    'zh': '修改后的句子',
    'es': 'Frase corregida',
    'fr': 'Phrase corrigée',
    'de': 'Korrigierter Satz',
    'pt': 'Frase corrigida',
    'ru': 'Исправленное предложение',
  });

  String get explanation => _pick({
    'ko': '설명',
    'en': 'Explanation',
    'ja': '説明',
    'zh': '说明',
    'es': 'Explicación',
    'fr': 'Explication',
    'de': 'Erklärung',
    'pt': 'Explicação',
    'ru': 'Объяснение',
  });

  String get correctionUpdated => _pick({
    'ko': '첨삭을 수정했어요',
    'en': 'Correction updated',
    'ja': '添削を更新しました',
    'zh': '批改已更新',
    'es': 'Corrección actualizada',
    'fr': 'Correction mise à jour',
    'de': 'Korrektur aktualisiert',
    'pt': 'Correção atualizada',
    'ru': 'Правка обновлена',
  });

  String get approved => _pick({
    'ko': '승인됨',
    'en': 'Approved',
    'ja': '承認済み',
    'zh': '已批准',
    'es': 'Aprobado',
    'fr': 'Approuvé',
    'de': 'Genehmigt',
    'pt': 'Aprovado',
    'ru': 'Одобрено',
  });

  String get rejected => _pick({
    'ko': '반려됨',
    'en': 'Rejected',
    'ja': '差し戻し',
    'zh': '已拒绝',
    'es': 'Rechazado',
    'fr': 'Refusé',
    'de': 'Abgelehnt',
    'pt': 'Rejeitado',
    'ru': 'Отклонено',
  });

  String get underReview => _pick({
    'ko': '검토중',
    'en': 'Reviewing',
    'ja': '確認中',
    'zh': '审核中',
    'es': 'En revisión',
    'fr': 'En revue',
    'de': 'In Prüfung',
    'pt': 'Em revisão',
    'ru': 'На проверке',
  });

  String get aiCorrection => _pick({
    'ko': 'AI 교정',
    'en': 'AI correction',
    'ja': 'AI添削',
    'zh': 'AI 批改',
    'es': 'Corrección IA',
    'fr': 'Correction IA',
    'de': 'KI-Korrektur',
    'pt': 'Correção por IA',
    'ru': 'Проверка ИИ',
  });

  String get humanCorrection => _pick({
    'ko': '사람 교정',
    'en': 'Human correction',
    'ja': '人の添削',
    'zh': '人工批改',
    'es': 'Corrección humana',
    'fr': 'Correction humaine',
    'de': 'Menschliche Korrektur',
    'pt': 'Correção humana',
    'ru': 'Проверка человеком',
  });

  String get segmentComments => _pick({
    'ko': '구간 코멘트',
    'en': 'Segment comments',
    'ja': '区間コメント',
    'zh': '片段评论',
    'es': 'Comentarios por tramo',
    'fr': 'Commentaires par segment',
    'de': 'Abschnittskommentare',
    'pt': 'Comentários por trecho',
    'ru': 'Комментарии к фрагментам',
  });

  String get nativeReRecording => _pick({
    'ko': '원어민 재녹음',
    'en': 'Native re-recording',
    'ja': 'ネイティブ再録音',
    'zh': '母语者重录',
    'es': 'Regrabación nativa',
    'fr': 'Réenregistrement natif',
    'de': 'Neuaufnahme von Muttersprachler',
    'pt': 'Regravação nativa',
    'ru': 'Запись носителя',
  });

  String get ratingQuestion => _pick({
    'ko': '이 첨삭이 도움이 됐나요?',
    'en': 'Was this correction helpful?',
    'ja': 'この添削は役に立ちましたか？',
    'zh': '这条批改有帮助吗？',
    'es': '¿Te ayudó esta corrección?',
    'fr': 'Cette correction vous a-t-elle aidé ?',
    'de': 'War diese Korrektur hilfreich?',
    'pt': 'Esta correção ajudou?',
    'ru': 'Эта правка была полезной?',
  });

  String get saveCard => _pick({
    'ko': '스터디 카드로 저장',
    'en': 'Save as study card',
    'ja': '学習カードとして保存',
    'zh': '保存为学习卡',
    'es': 'Guardar como tarjeta',
    'fr': 'Enregistrer comme carte',
    'de': 'Als Lernkarte speichern',
    'pt': 'Salvar como cartão',
    'ru': 'Сохранить как карточку',
  });

  String get audioCardDefault => _pick({
    'ko': '음성 첨삭 카드',
    'en': 'Audio correction card',
    'ja': '音声添削カード',
    'zh': '语音批改卡',
    'es': 'Tarjeta de audio',
    'fr': 'Carte de correction audio',
    'de': 'Audio-Korrekturkarte',
    'pt': 'Cartão de correção de áudio',
    'ru': 'Карточка аудио-проверки',
  });

  String get choosePractice => _pick({
    'ko': '저장할 연습을 선택하세요',
    'en': 'Choose where to save it',
    'ja': '保存先の練習を選んでください',
    'zh': '选择保存到哪个练习',
    'es': 'Elige dónde guardarla',
    'fr': 'Choisissez où l’enregistrer',
    'de': 'Wähle, wo sie gespeichert wird',
    'pt': 'Escolha onde salvar',
    'ru': 'Выберите, куда сохранить',
  });

  String get noPracticeForCard => _pick({
    'ko': '먼저 친구와 연습을 시작하면 카드로 저장할 수 있어요.',
    'en': 'Start practice with a friend first, then save cards.',
    'ja': '先に友達との練習を始めるとカード保存できます。',
    'zh': '先和好友开始练习后即可保存卡片。',
    'es': 'Primero empieza una práctica con un amigo.',
    'fr': 'Commencez d’abord une pratique avec un ami.',
    'de': 'Starte zuerst eine Übung mit einem Freund.',
    'pt': 'Comece uma prática com um amigo primeiro.',
    'ru': 'Сначала начните практику с другом.',
  });

  String get cardSaved => _pick({
    'ko': '카드로 저장했어요',
    'en': 'Saved as a card',
    'ja': 'カードに保存しました',
    'zh': '已保存为卡片',
    'es': 'Guardado como tarjeta',
    'fr': 'Enregistré comme carte',
    'de': 'Als Karte gespeichert',
    'pt': 'Salvo como cartão',
    'ru': 'Сохранено как карточка',
  });

  String get pronunciation => _pick({
    'ko': '발음',
    'en': 'Pronunciation',
    'ja': '発音',
    'zh': '发音',
    'es': 'Pronunciación',
    'fr': 'Prononciation',
    'de': 'Aussprache',
    'pt': 'Pronúncia',
    'ru': 'Произношение',
  });

  String get intonation => _pick({
    'ko': '억양',
    'en': 'Intonation',
    'ja': 'イントネーション',
    'zh': '语调',
    'es': 'Entonación',
    'fr': 'Intonation',
    'de': 'Intonation',
    'pt': 'Entonação',
    'ru': 'Интонация',
  });

  String get fluency => _pick({
    'ko': '이해도',
    'en': 'Clarity',
    'ja': '伝わりやすさ',
    'zh': '清晰度',
    'es': 'Claridad',
    'fr': 'Clarté',
    'de': 'Verständlichkeit',
    'pt': 'Clareza',
    'ru': 'Понятность',
  });

  String get studyTitle => _pick({
    'ko': '친구와 연습',
    'en': 'Practice with friends',
    'ja': '学習',
    'zh': '学习',
    'es': 'Estudio',
    'fr': 'Étude',
    'de': 'Lernen',
    'pt': 'Estudo',
    'ru': 'Учеба',
  });

  String friendRequestCount(int count) => _format(
    _pick({
      'ko': '친구 요청 {count}개',
      'en': '{count} friend requests',
      'ja': '友達リクエスト {count}件',
      'zh': '{count} 个好友请求',
      'es': '{count} solicitudes',
      'fr': '{count} demandes d’ami',
      'de': '{count} Freundschaftsanfragen',
      'pt': '{count} pedidos de amizade',
      'ru': '{count} заявок в друзья',
    }),
    {'count': count.toString()},
  );

  String get addFriend => _pick({
    'ko': '친구 추가',
    'en': 'Add friend',
    'ja': '友達を追加',
    'zh': '添加好友',
    'es': 'Añadir amigo',
    'fr': 'Ajouter un ami',
    'de': 'Freund hinzufügen',
    'pt': 'Adicionar amigo',
    'ru': 'Добавить друга',
  });

  String get decline => _pick({
    'ko': '거절',
    'en': 'Decline',
    'ja': '拒否',
    'zh': '拒绝',
    'es': 'Rechazar',
    'fr': 'Refuser',
    'de': 'Ablehnen',
    'pt': 'Recusar',
    'ru': 'Отклонить',
  });

  String get accept => _pick({
    'ko': '수락',
    'en': 'Accept',
    'ja': '承認',
    'zh': '接受',
    'es': 'Aceptar',
    'fr': 'Accepter',
    'de': 'Annehmen',
    'pt': 'Aceitar',
    'ru': 'Принять',
  });

  String get friendRequestDeclineFailed => _pick({
    'ko': '요청 거절에 실패했어요. 다시 시도해 주세요.',
    'en': 'Could not decline the request. Please try again.',
    'ja': 'リクエストを拒否できませんでした。もう一度お試しください。',
    'zh': '无法拒绝请求。请重试。',
    'es': 'No se pudo rechazar la solicitud. Inténtalo de nuevo.',
    'fr': 'Impossible de refuser la demande. Réessayez.',
    'de': 'Anfrage konnte nicht abgelehnt werden. Bitte erneut versuchen.',
    'pt': 'Não foi possível recusar o pedido. Tente novamente.',
    'ru': 'Не удалось отклонить заявку. Попробуйте снова.',
  });

  String get friendRequestAcceptFailed => _pick({
    'ko': '요청 수락에 실패했어요. 다시 시도해 주세요.',
    'en': 'Could not accept the request. Please try again.',
    'ja': 'リクエストを承認できませんでした。もう一度お試しください。',
    'zh': '无法接受请求。请重试。',
    'es': 'No se pudo aceptar la solicitud. Inténtalo de nuevo.',
    'fr': 'Impossible d’accepter la demande. Réessayez.',
    'de': 'Anfrage konnte nicht angenommen werden. Bitte erneut versuchen.',
    'pt': 'Não foi possível aceitar o pedido. Tente novamente.',
    'ru': 'Не удалось принять заявку. Попробуйте снова.',
  });

  String friendAccepted(String name) => _format(
    _pick({
      'ko': '{name} 님과 친구가 되었어요!',
      'en': 'You are now friends with {name}!',
      'ja': '{name}さんと友達になりました！',
      'zh': '你和 {name} 已成为好友！',
      'es': '¡Ahora eres amigo de {name}!',
      'fr': 'Vous êtes maintenant ami avec {name} !',
      'de': 'Du bist jetzt mit {name} befreundet!',
      'pt': 'Você agora é amigo de {name}!',
      'ru': 'Теперь вы друзья с {name}!',
    }),
    {'name': name},
  );

  String get friends => _pick({
    'ko': '친구',
    'en': 'Friends',
    'ja': '友達',
    'zh': '好友',
    'es': 'Amigos',
    'fr': 'Amis',
    'de': 'Freunde',
    'pt': 'Amigos',
    'ru': 'Друзья',
  });

  String get friendsLoadFailed => _pick({
    'ko': '친구 목록을 불러올 수 없어요',
    'en': 'Could not load friends',
    'ja': '友達一覧を読み込めません',
    'zh': '无法加载好友列表',
    'es': 'No se pudieron cargar los amigos',
    'fr': 'Impossible de charger les amis',
    'de': 'Freunde konnten nicht geladen werden',
    'pt': 'Não foi possível carregar amigos',
    'ru': 'Не удалось загрузить друзей',
  });

  String get noFriends => _pick({
    'ko': '아직 친구가 없어요. 상단 + 버튼으로 추가해보세요.',
    'en': 'No friends yet. Add one with the + button.',
    'ja': '友達はまだいません。上の+ボタンで追加しましょう。',
    'zh': '还没有好友。用顶部 + 按钮添加吧。',
    'es': 'Aún no tienes amigos. Añade uno con el botón +.',
    'fr': 'Pas encore d’amis. Ajoutez-en avec le bouton +.',
    'de': 'Noch keine Freunde. Füge über die +-Taste jemanden hinzu.',
    'pt': 'Ainda não há amigos. Adicione com o botão +.',
    'ru': 'Друзей пока нет. Добавьте через кнопку +.',
  });

  String get sessions => _pick({
    'ko': '연습',
    'en': 'Practice',
    'ja': 'セッション',
    'zh': '会话',
    'es': 'Sesiones',
    'fr': 'Sessions',
    'de': 'Sitzungen',
    'pt': 'Sessões',
    'ru': 'Сессии',
  });

  String get noSessions => _pick({
    'ko': '아직 같이 연습 중인 친구가 없어요.\n친구를 골라 첫 표현을 주고받아보세요.',
    'en':
        'No active practice yet.\nPick a friend and exchange your first phrase.',
    'ja': 'セッションはまだありません。\n友達と学習を始めましょう！',
    'zh': '还没有会话。\n和好友一起开始学习吧！',
    'es': 'Aún no hay sesiones.\n¡Empieza a estudiar con un amigo!',
    'fr': 'Aucune session pour le moment.\nCommencez avec un ami !',
    'de': 'Noch keine Sitzungen.\nStarte mit einem Freund!',
    'pt': 'Ainda não há sessões.\nComece com um amigo!',
    'ru': 'Сессий пока нет.\nНачните заниматься с другом!',
  });

  String get defaultSessionTitle => _pick({
    'ko': '친구와 연습',
    'en': 'Practice with a friend',
    'ja': '学習セッション',
    'zh': '学习会话',
    'es': 'Sesión de estudio',
    'fr': 'Session d’étude',
    'de': 'Lernsitzung',
    'pt': 'Sessão de estudo',
    'ru': 'Учебная сессия',
  });

  String participantCount(int count) => _format(
    _pick({
      'ko': '{count}명 참여 중',
      'en': '{count} participants',
      'ja': '{count}人が参加中',
      'zh': '{count} 人参与',
      'es': '{count} participantes',
      'fr': '{count} participants',
      'de': '{count} Teilnehmer',
      'pt': '{count} participantes',
      'ru': '{count} участников',
    }),
    {'count': count.toString()},
  );

  String get newSession => _pick({
    'ko': '연습 시작',
    'en': 'Start practice',
    'ja': '新しいセッション',
    'zh': '新会话',
    'es': 'Nueva sesión',
    'fr': 'Nouvelle session',
    'de': 'Neue Sitzung',
    'pt': 'Nova sessão',
    'ru': 'Новая сессия',
  });

  String removeFriendConfirm(String name) => _format(
    _pick({
      'ko': '{name} 님을 친구 목록에서 삭제할까요?',
      'en': 'Remove {name} from your friends?',
      'ja': '{name}さんを友達から削除しますか？',
      'zh': '要从好友列表中删除 {name} 吗？',
      'es': '¿Eliminar a {name} de tus amigos?',
      'fr': 'Retirer {name} de vos amis ?',
      'de': '{name} aus deinen Freunden entfernen?',
      'pt': 'Remover {name} dos amigos?',
      'ru': 'Удалить {name} из друзей?',
    }),
    {'name': name},
  );

  String friendRemoved(String name) => _format(
    _pick({
      'ko': '{name} 님을 친구 목록에서 삭제했어요.',
      'en': 'Removed {name} from your friends.',
      'ja': '{name}さんを友達から削除しました。',
      'zh': '已从好友列表中删除 {name}。',
      'es': '{name} eliminado de tus amigos.',
      'fr': '{name} a été retiré de vos amis.',
      'de': '{name} wurde aus deinen Freunden entfernt.',
      'pt': '{name} foi removido dos amigos.',
      'ru': '{name} удален из друзей.',
    }),
    {'name': name},
  );

  String get removeFriendFailed => _pick({
    'ko': '친구 삭제에 실패했어요. 다시 시도해 주세요.',
    'en': 'Could not remove friend. Please try again.',
    'ja': '友達を削除できませんでした。もう一度お試しください。',
    'zh': '删除好友失败。请重试。',
    'es': 'No se pudo eliminar el amigo. Inténtalo de nuevo.',
    'fr': 'Impossible de retirer cet ami. Réessayez.',
    'de': 'Freund konnte nicht entfernt werden. Bitte erneut versuchen.',
    'pt': 'Não foi possível remover o amigo. Tente novamente.',
    'ru': 'Не удалось удалить друга. Попробуйте снова.',
  });

  String get friendRequestSent => _pick({
    'ko': '친구 요청을 보냈어요!',
    'en': 'Friend request sent!',
    'ja': '友達リクエストを送りました！',
    'zh': '好友请求已发送！',
    'es': '¡Solicitud enviada!',
    'fr': 'Demande envoyée !',
    'de': 'Freundschaftsanfrage gesendet!',
    'pt': 'Pedido de amizade enviado!',
    'ru': 'Заявка отправлена!',
  });

  String get friendNotFound => _pick({
    'ko': '해당 유저를 찾을 수 없어요.',
    'en': 'Could not find that user.',
    'ja': 'そのユーザーは見つかりません。',
    'zh': '找不到该用户。',
    'es': 'No se encontró ese usuario.',
    'fr': 'Utilisateur introuvable.',
    'de': 'Benutzer nicht gefunden.',
    'pt': 'Usuário não encontrado.',
    'ru': 'Пользователь не найден.',
  });

  String get cannotAddSelf => _pick({
    'ko': '자기 자신에게 친구 요청을 보낼 수 없어요.',
    'en': 'You cannot send a friend request to yourself.',
    'ja': '自分自身に友達リクエストは送れません。',
    'zh': '不能给自己发送好友请求。',
    'es': 'No puedes enviarte una solicitud a ti mismo.',
    'fr': 'Vous ne pouvez pas vous envoyer une demande.',
    'de': 'Du kannst dir selbst keine Anfrage senden.',
    'pt': 'Você não pode enviar pedido para si mesmo.',
    'ru': 'Нельзя отправить заявку самому себе.',
  });

  String get alreadySentFriendRequest => _pick({
    'ko': '이미 친구 요청을 보냈어요.',
    'en': 'Friend request already sent.',
    'ja': '友達リクエストは送信済みです。',
    'zh': '好友请求已发送。',
    'es': 'La solicitud ya fue enviada.',
    'fr': 'Demande déjà envoyée.',
    'de': 'Anfrage wurde bereits gesendet.',
    'pt': 'Pedido já enviado.',
    'ru': 'Заявка уже отправлена.',
  });

  String get usernameSearch => _pick({
    'ko': '유저명 검색',
    'en': 'Search username',
    'ja': 'ユーザー名を検索',
    'zh': '搜索用户名',
    'es': 'Buscar usuario',
    'fr': 'Rechercher un nom',
    'de': 'Benutzername suchen',
    'pt': 'Buscar usuário',
    'ru': 'Поиск имени',
  });

  String get searchFailed => _pick({
    'ko': '검색 중 오류가 발생했어요. 다시 시도해 주세요.',
    'en': 'Search failed. Please try again.',
    'ja': '検索中にエラーが発生しました。もう一度お試しください。',
    'zh': '搜索出错。请重试。',
    'es': 'Error al buscar. Inténtalo de nuevo.',
    'fr': 'Erreur de recherche. Réessayez.',
    'de': 'Suche fehlgeschlagen. Bitte erneut versuchen.',
    'pt': 'Erro na busca. Tente novamente.',
    'ru': 'Ошибка поиска. Попробуйте снова.',
  });

  String get noSearchResults => _pick({
    'ko': '검색 결과가 없습니다.',
    'en': 'No results found.',
    'ja': '検索結果がありません。',
    'zh': '没有搜索结果。',
    'es': 'No hay resultados.',
    'fr': 'Aucun résultat.',
    'de': 'Keine Ergebnisse.',
    'pt': 'Nenhum resultado.',
    'ru': 'Ничего не найдено.',
  });

  String get sendRequest => _pick({
    'ko': '요청 보내기',
    'en': 'Send request',
    'ja': 'リクエストを送信',
    'zh': '发送请求',
    'es': 'Enviar solicitud',
    'fr': 'Envoyer la demande',
    'de': 'Anfrage senden',
    'pt': 'Enviar pedido',
    'ru': 'Отправить заявку',
  });

  String get newStudySession => _pick({
    'ko': '친구와 새 연습',
    'en': 'New practice with a friend',
    'ja': '新しい学習セッション',
    'zh': '新学习会话',
    'es': 'Nueva sesión de estudio',
    'fr': 'Nouvelle session d’étude',
    'de': 'Neue Lernsitzung',
    'pt': 'Nova sessão de estudo',
    'ru': 'Новая учебная сессия',
  });

  String get studyPartner => _pick({
    'ko': '함께할 친구',
    'en': 'Study partner',
    'ja': '一緒に学ぶ友達',
    'zh': '一起学习的好友',
    'es': 'Amigo de estudio',
    'fr': 'Partenaire d’étude',
    'de': 'Lernpartner',
    'pt': 'Parceiro de estudo',
    'ru': 'Партнер по учебе',
  });

  String get optionalSessionName => _pick({
    'ko': '연습 이름 (선택)',
    'en': 'Practice name (optional)',
    'ja': 'セッション名（任意）',
    'zh': '会话名称（可选）',
    'es': 'Nombre de sesión (opcional)',
    'fr': 'Nom de session (facultatif)',
    'de': 'Sitzungsname (optional)',
    'pt': 'Nome da sessão (opcional)',
    'ru': 'Название сессии (необязательно)',
  });

  String get start => _pick({
    'ko': '시작하기',
    'en': 'Start',
    'ja': '開始',
    'zh': '开始',
    'es': 'Empezar',
    'fr': 'Commencer',
    'de': 'Starten',
    'pt': 'Começar',
    'ru': 'Начать',
  });

  String get sessionAlreadyExists => _pick({
    'ko': '이미 해당 친구와 진행 중인 연습이 있어요.',
    'en': 'You already have active practice with this friend.',
    'ja': 'この友達とは進行中のセッションがあります。',
    'zh': '你已经和这位好友有进行中的会话。',
    'es': 'Ya tienes una sesión activa con este amigo.',
    'fr': 'Vous avez déjà une session active avec cet ami.',
    'de': 'Mit diesem Freund gibt es bereits eine aktive Sitzung.',
    'pt': 'Você já tem uma sessão ativa com esse amigo.',
    'ru': 'У вас уже есть активная сессия с этим другом.',
  });

  String get sessionCreateFailed => _pick({
    'ko': '연습을 시작하지 못했어요. 다시 시도해 주세요.',
    'en': 'Could not start practice. Please try again.',
    'ja': 'セッションを作成できませんでした。もう一度お試しください。',
    'zh': '创建会话失败。请重试。',
    'es': 'No se pudo crear la sesión. Inténtalo de nuevo.',
    'fr': 'Impossible de créer la session. Réessayez.',
    'de': 'Sitzung konnte nicht erstellt werden. Bitte erneut versuchen.',
    'pt': 'Não foi possível criar a sessão. Tente novamente.',
    'ru': 'Не удалось создать сессию. Попробуйте снова.',
  });

  String _format(String template, Map<String, String> values) {
    var result = template;
    values.forEach((key, value) {
      result = result.replaceAll('{$key}', value);
    });
    return result;
  }

  String _pick(Map<String, String> values) => values[language] ?? values['ko']!;
}

Locale localeForUiLanguage(String language) {
  return Locale(normalizeUiLanguage(language));
}
