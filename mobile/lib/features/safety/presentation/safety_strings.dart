import 'package:tonebridge/core/i18n/ui_language.dart';
import 'package:tonebridge/features/safety/domain/safety_repository.dart';

/// Report and block strings. Kept beside the feature instead of growing
/// `ui_language.dart`; same 9 languages and Korean fallback.
extension SafetyStrings on ToneBridgeStrings {
  String _s(Map<String, String> values) => values[language] ?? values['ko']!;

  String _named(Map<String, String> values, String name) =>
      _s(values).replaceAll('{name}', name.isEmpty ? '-' : name);

  String get moreActions => _s({
    'ko': '더보기',
    'en': 'More',
    'ja': 'その他',
    'zh': '更多',
    'es': 'Más',
    'fr': 'Plus',
    'de': 'Mehr',
    'pt': 'Mais',
    'ru': 'Ещё',
  });

  String get report => _s({
    'ko': '신고',
    'en': 'Report',
    'ja': '報告',
    'zh': '举报',
    'es': 'Denunciar',
    'fr': 'Signaler',
    'de': 'Melden',
    'pt': 'Denunciar',
    'ru': 'Пожаловаться',
  });

  String get reportUser => _s({
    'ko': '사용자 신고',
    'en': 'Report user',
    'ja': 'ユーザーを報告',
    'zh': '举报用户',
    'es': 'Denunciar usuario',
    'fr': 'Signaler l’utilisateur',
    'de': 'Nutzer melden',
    'pt': 'Denunciar usuário',
    'ru': 'Пожаловаться на пользователя',
  });

  String get reportContent => _s({
    'ko': '콘텐츠 신고',
    'en': 'Report content',
    'ja': 'コンテンツを報告',
    'zh': '举报内容',
    'es': 'Denunciar contenido',
    'fr': 'Signaler le contenu',
    'de': 'Inhalt melden',
    'pt': 'Denunciar conteúdo',
    'ru': 'Пожаловаться на контент',
  });

  String get reportReasonPrompt => _s({
    'ko': '어떤 문제인가요?',
    'en': 'What’s the problem?',
    'ja': 'どのような問題ですか？',
    'zh': '是什么问题？',
    'es': '¿Cuál es el problema?',
    'fr': 'Quel est le problème ?',
    'de': 'Was ist das Problem?',
    'pt': 'Qual é o problema?',
    'ru': 'В чём проблема?',
  });

  String reportReason(ReportReason reason) => switch (reason) {
    ReportReason.spam => _s({
      'ko': '스팸 또는 광고',
      'en': 'Spam or advertising',
      'ja': 'スパム・宣伝',
      'zh': '垃圾信息或广告',
      'es': 'Spam o publicidad',
      'fr': 'Spam ou publicité',
      'de': 'Spam oder Werbung',
      'pt': 'Spam ou publicidade',
      'ru': 'Спам или реклама',
    }),
    ReportReason.harassment => _s({
      'ko': '괴롭힘 또는 따돌림',
      'en': 'Harassment or bullying',
      'ja': '嫌がらせ・いじめ',
      'zh': '骚扰或欺凌',
      'es': 'Acoso',
      'fr': 'Harcèlement',
      'de': 'Belästigung oder Mobbing',
      'pt': 'Assédio ou bullying',
      'ru': 'Травля или оскорбления',
    }),
    ReportReason.hate => _s({
      'ko': '혐오 표현',
      'en': 'Hate speech',
      'ja': 'ヘイトスピーチ',
      'zh': '仇恨言论',
      'es': 'Discurso de odio',
      'fr': 'Discours haineux',
      'de': 'Hassrede',
      'pt': 'Discurso de ódio',
      'ru': 'Разжигание ненависти',
    }),
    ReportReason.sexual => _s({
      'ko': '성적인 콘텐츠',
      'en': 'Sexual content',
      'ja': '性的なコンテンツ',
      'zh': '色情内容',
      'es': 'Contenido sexual',
      'fr': 'Contenu sexuel',
      'de': 'Sexuelle Inhalte',
      'pt': 'Conteúdo sexual',
      'ru': 'Сексуальный контент',
    }),
    ReportReason.violence => _s({
      'ko': '폭력 또는 위협',
      'en': 'Violence or threats',
      'ja': '暴力・脅迫',
      'zh': '暴力或威胁',
      'es': 'Violencia o amenazas',
      'fr': 'Violence ou menaces',
      'de': 'Gewalt oder Drohungen',
      'pt': 'Violência ou ameaças',
      'ru': 'Насилие или угрозы',
    }),
    ReportReason.illegal => _s({
      'ko': '불법 콘텐츠',
      'en': 'Illegal content',
      'ja': '違法なコンテンツ',
      'zh': '违法内容',
      'es': 'Contenido ilegal',
      'fr': 'Contenu illégal',
      'de': 'Illegale Inhalte',
      'pt': 'Conteúdo ilegal',
      'ru': 'Незаконный контент',
    }),
    ReportReason.other => _s({
      'ko': '기타',
      'en': 'Something else',
      'ja': 'その他',
      'zh': '其他',
      'es': 'Otro',
      'fr': 'Autre',
      'de': 'Etwas anderes',
      'pt': 'Outro',
      'ru': 'Другое',
    }),
  };

  String get reportDetailHint => _s({
    'ko': '자세한 내용 (선택)',
    'en': 'Details (optional)',
    'ja': '詳細（任意）',
    'zh': '详细说明（可选）',
    'es': 'Detalles (opcional)',
    'fr': 'Détails (facultatif)',
    'de': 'Details (optional)',
    'pt': 'Detalhes (opcional)',
    'ru': 'Подробности (необязательно)',
  });

  String alsoBlock(String name) => _named({
    'ko': '{name}님도 차단하기',
    'en': 'Also block {name}',
    'ja': '{name}さんもブロックする',
    'zh': '同时屏蔽 {name}',
    'es': 'Bloquear también a {name}',
    'fr': 'Bloquer aussi {name}',
    'de': '{name} auch blockieren',
    'pt': 'Bloquear também {name}',
    'ru': 'Также заблокировать {name}',
  }, name);

  String get alsoBlockAuthor => _s({
    'ko': '작성자도 차단하기',
    'en': 'Also block the author',
    'ja': '投稿者もブロックする',
    'zh': '同时屏蔽作者',
    'es': 'Bloquear también al autor',
    'fr': 'Bloquer aussi l’auteur',
    'de': 'Verfasser auch blockieren',
    'pt': 'Bloquear também o autor',
    'ru': 'Также заблокировать автора',
  });

  String get sendReport => _s({
    'ko': '신고 보내기',
    'en': 'Send report',
    'ja': '報告を送信',
    'zh': '提交举报',
    'es': 'Enviar denuncia',
    'fr': 'Envoyer le signalement',
    'de': 'Meldung senden',
    'pt': 'Enviar denúncia',
    'ru': 'Отправить жалобу',
  });

  String get reportSent => _s({
    'ko': '신고가 접수됐어요. 24시간 안에 검토할게요.',
    'en': 'Report sent. We’ll review it within 24 hours.',
    'ja': '報告を受け付けました。24時間以内に確認します。',
    'zh': '举报已提交，我们会在 24 小时内处理。',
    'es': 'Denuncia enviada. La revisaremos en 24 horas.',
    'fr': 'Signalement envoyé. Nous l’examinerons sous 24 heures.',
    'de': 'Meldung gesendet. Wir prüfen sie innerhalb von 24 Stunden.',
    'pt': 'Denúncia enviada. Vamos analisá-la em até 24 horas.',
    'ru': 'Жалоба отправлена. Мы рассмотрим её в течение 24 часов.',
  });

  String get reportOwnContent => _s({
    'ko': '내가 올린 콘텐츠는 신고할 수 없어요.',
    'en': 'You can’t report your own content.',
    'ja': '自分のコンテンツは報告できません。',
    'zh': '无法举报自己的内容。',
    'es': 'No puedes denunciar tu propio contenido.',
    'fr': 'Vous ne pouvez pas signaler votre propre contenu.',
    'de': 'Eigene Inhalte kannst du nicht melden.',
    'pt': 'Você não pode denunciar seu próprio conteúdo.',
    'ru': 'Нельзя пожаловаться на свой контент.',
  });

  String get reportLimitReached => _s({
    'ko': '오늘은 더 신고할 수 없어요. 급한 문제는 support@mungji.com 으로 알려 주세요.',
    'en': 'You’ve reached today’s report limit. For urgent issues, email support@mungji.com.',
    'ja': '本日の報告上限に達しました。緊急の場合は support@mungji.com へご連絡ください。',
    'zh': '今日举报次数已达上限。紧急问题请发邮件至 support@mungji.com。',
    'es': 'Has alcanzado el límite diario. Para algo urgente, escribe a support@mungji.com.',
    'fr': 'Limite quotidienne atteinte. En cas d’urgence, écrivez à support@mungji.com.',
    'de': 'Tageslimit erreicht. Bei Dringendem schreib an support@mungji.com.',
    'pt': 'Limite diário atingido. Para casos urgentes, escreva para support@mungji.com.',
    'ru': 'Дневной лимит жалоб исчерпан. Срочное — на support@mungji.com.',
  });

  String get reportTargetGone => _s({
    'ko': '이미 삭제됐거나 볼 수 없는 콘텐츠예요.',
    'en': 'This content was removed or is no longer available.',
    'ja': 'このコンテンツは削除されたか、表示できません。',
    'zh': '该内容已被删除或无法查看。',
    'es': 'Este contenido se eliminó o ya no está disponible.',
    'fr': 'Ce contenu a été supprimé ou n’est plus disponible.',
    'de': 'Dieser Inhalt wurde entfernt oder ist nicht mehr verfügbar.',
    'pt': 'Este conteúdo foi removido ou não está mais disponível.',
    'ru': 'Этот контент удалён или недоступен.',
  });

  String get block => _s({
    'ko': '차단',
    'en': 'Block',
    'ja': 'ブロック',
    'zh': '屏蔽',
    'es': 'Bloquear',
    'fr': 'Bloquer',
    'de': 'Blockieren',
    'pt': 'Bloquear',
    'ru': 'Заблокировать',
  });

  String get blockAuthor => _s({
    'ko': '작성자 차단',
    'en': 'Block author',
    'ja': '投稿者をブロック',
    'zh': '屏蔽作者',
    'es': 'Bloquear al autor',
    'fr': 'Bloquer l’auteur',
    'de': 'Verfasser blockieren',
    'pt': 'Bloquear autor',
    'ru': 'Заблокировать автора',
  });

  String blockConfirmTitle(String name) => _named({
    'ko': '{name}님을 차단할까요?',
    'en': 'Block {name}?',
    'ja': '{name}さんをブロックしますか？',
    'zh': '要屏蔽 {name} 吗？',
    'es': '¿Bloquear a {name}?',
    'fr': 'Bloquer {name} ?',
    'de': '{name} blockieren?',
    'pt': 'Bloquear {name}?',
    'ru': 'Заблокировать {name}?',
  }, name);

  String get blockConfirmTitleAuthor => _s({
    'ko': '작성자를 차단할까요?',
    'en': 'Block the author?',
    'ja': '投稿者をブロックしますか？',
    'zh': '要屏蔽作者吗？',
    'es': '¿Bloquear al autor?',
    'fr': 'Bloquer l’auteur ?',
    'de': 'Verfasser blockieren?',
    'pt': 'Bloquear o autor?',
    'ru': 'Заблокировать автора?',
  });

  String get blockConfirmBody => _s({
    'ko': '친구 관계와 대기 중인 요청이 삭제되고, 함께 쓰던 연습장에서 서로 나가게 돼요. 서로 연락하거나 친구 요청을 보낼 수 없어요. 설정에서 언제든 해제할 수 있어요.',
    'en': 'Your friendship and any pending requests are removed, and you both leave the notebooks you shared. Neither of you can contact the other or send friend requests. You can unblock anytime in Settings.',
    'ja': '友達関係と保留中のリクエストが削除され、共有していた練習帳から互いに退出します。連絡や友達リクエストはできなくなります。設定からいつでも解除できます。',
    'zh': '好友关系和待处理的请求将被删除，你们都会退出共享的练习本。双方都无法联系对方或发送好友请求。可随时在设置中解除。',
    'es': 'Se eliminan la amistad y las solicitudes pendientes, y ambos salen de los cuadernos compartidos. Ninguno podrá contactar al otro ni enviar solicitudes. Puedes desbloquear en Ajustes.',
    'fr': 'L’amitié et les demandes en attente sont supprimées, et vous quittez tous deux les carnets partagés. Aucun de vous ne pourra contacter l’autre ni envoyer de demande. Débloquez à tout moment dans les réglages.',
    'de': 'Freundschaft und offene Anfragen werden entfernt, und ihr verlasst beide die gemeinsamen Hefte. Keiner kann den anderen kontaktieren oder Anfragen senden. Aufheben jederzeit in den Einstellungen.',
    'pt': 'A amizade e os pedidos pendentes são removidos, e vocês saem dos cadernos compartilhados. Nenhum dos dois poderá contatar o outro nem enviar pedidos. Desbloqueie quando quiser em Ajustes.',
    'ru': 'Дружба и ожидающие заявки удаляются, и вы оба покидаете общие тетради. Никто из вас не сможет связаться с другим или отправить заявку. Разблокировать можно в настройках.',
  });

  String get blockedDone => _s({
    'ko': '차단했어요.',
    'en': 'Blocked.',
    'ja': 'ブロックしました。',
    'zh': '已屏蔽。',
    'es': 'Bloqueado.',
    'fr': 'Bloqué.',
    'de': 'Blockiert.',
    'pt': 'Bloqueado.',
    'ru': 'Заблокировано.',
  });

  String get unblock => _s({
    'ko': '차단 해제',
    'en': 'Unblock',
    'ja': 'ブロック解除',
    'zh': '解除屏蔽',
    'es': 'Desbloquear',
    'fr': 'Débloquer',
    'de': 'Freigeben',
    'pt': 'Desbloquear',
    'ru': 'Разблокировать',
  });

  String unblockConfirm(String name) => _named({
    'ko': '{name}님의 차단을 해제할까요? 친구 관계는 다시 요청해야 해요.',
    'en': 'Unblock {name}? You’ll need to send a new friend request.',
    'ja': '{name}さんのブロックを解除しますか？友達になるには再度リクエストが必要です。',
    'zh': '要解除对 {name} 的屏蔽吗？需要重新发送好友请求。',
    'es': '¿Desbloquear a {name}? Tendrás que enviar una nueva solicitud.',
    'fr': 'Débloquer {name} ? Il faudra envoyer une nouvelle demande d’ami.',
    'de': '{name} freigeben? Eine neue Freundschaftsanfrage ist nötig.',
    'pt': 'Desbloquear {name}? Será preciso enviar um novo pedido de amizade.',
    'ru': 'Разблокировать {name}? Нужно будет снова отправить заявку в друзья.',
  }, name);

  String get blockedUsers => _s({
    'ko': '차단한 사용자',
    'en': 'Blocked users',
    'ja': 'ブロックしたユーザー',
    'zh': '已屏蔽的用户',
    'es': 'Usuarios bloqueados',
    'fr': 'Utilisateurs bloqués',
    'de': 'Blockierte Nutzer',
    'pt': 'Usuários bloqueados',
    'ru': 'Заблокированные',
  });

  String get blockedUsersSubtitle => _s({
    'ko': '차단 목록을 보고 해제할 수 있어요',
    'en': 'See and unblock people',
    'ja': 'ブロック中のユーザーを確認・解除',
    'zh': '查看并解除屏蔽',
    'es': 'Ver y desbloquear personas',
    'fr': 'Voir et débloquer des personnes',
    'de': 'Blockierte ansehen und freigeben',
    'pt': 'Ver e desbloquear pessoas',
    'ru': 'Просмотр и разблокировка',
  });

  String get noBlockedUsers => _s({
    'ko': '차단한 사용자가 없어요.',
    'en': 'You haven’t blocked anyone.',
    'ja': 'ブロックしたユーザーはいません。',
    'zh': '你还没有屏蔽任何人。',
    'es': 'No has bloqueado a nadie.',
    'fr': 'Vous n’avez bloqué personne.',
    'de': 'Du hast niemanden blockiert.',
    'pt': 'Você não bloqueou ninguém.',
    'ru': 'Вы никого не блокировали.',
  });

  String get blockedUsersLoadFailed => _s({
    'ko': '차단 목록을 불러오지 못했어요.',
    'en': 'Couldn’t load blocked users.',
    'ja': 'ブロックリストを読み込めませんでした。',
    'zh': '无法加载屏蔽列表。',
    'es': 'No se pudo cargar la lista de bloqueados.',
    'fr': 'Impossible de charger les utilisateurs bloqués.',
    'de': 'Blockierte Nutzer konnten nicht geladen werden.',
    'pt': 'Não foi possível carregar os bloqueados.',
    'ru': 'Не удалось загрузить список.',
  });

  String get loadMore => _s({
    'ko': '더 불러오기',
    'en': 'Load more',
    'ja': 'さらに読み込む',
    'zh': '加载更多',
    'es': 'Cargar más',
    'fr': 'Charger plus',
    'de': 'Mehr laden',
    'pt': 'Carregar mais',
    'ru': 'Загрузить ещё',
  });

  String get removeFriend => _s({
    'ko': '친구 삭제',
    'en': 'Remove friend',
    'ja': '友達を削除',
    'zh': '删除好友',
    'es': 'Eliminar amigo',
    'fr': 'Retirer l’ami',
    'de': 'Freund entfernen',
    'pt': 'Remover amigo',
    'ru': 'Удалить из друзей',
  });
}
