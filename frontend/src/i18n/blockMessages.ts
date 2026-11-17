const en = {
  'blocks.title': 'Blocked users', 'blocks.block': 'Block user', 'blocks.unblock': 'Unblock',
  'blocks.help': 'Blocking removes friendship and pending requests, closes shared notebook access for both users, and stops interactions. Records are preserved. Previously issued audio links can remain valid until expiry.',
  'blocks.unblockHelp': 'Unblocking does not restore friendship or shared notebook access.',
  'blocks.empty': 'No blocked users.',
}
const ko: typeof en = {
  'blocks.title': '차단한 사용자', 'blocks.block': '사용자 차단', 'blocks.unblock': '차단 해제',
  'blocks.help': '친구 관계와 대기 요청이 정리되고 두 사람의 공유 연습장 접근과 상호작용이 중단됩니다. 기록은 보존됩니다. 이미 발급된 음성 링크는 만료 전까지 유효할 수 있습니다.',
  'blocks.unblockHelp': '차단을 해제해도 친구 관계와 공유 연습장 접근은 자동 복원되지 않습니다.',
  'blocks.empty': '차단한 사용자가 없습니다.',
}
export type BlockMessageKey = keyof typeof en
export const blockMessages = { ko, en,
  ja: {"blocks.title": "ブロックしたユーザー", "blocks.block": "ユーザーをブロック", "blocks.unblock": "ブロック解除", "blocks.help": "友達関係と保留中の申請を削除し、双方の共有ノートへのアクセスと交流を停止します。記録は保持されます。発行済みの音声リンクは期限まで有効な場合があります。", "blocks.unblockHelp": "解除しても友達関係や共有ノートへのアクセスは自動復元されません。", "blocks.empty": "ブロックしたユーザーはいません。"},
  zh: {"blocks.title": "已屏蔽的用户", "blocks.block": "屏蔽用户", "blocks.unblock": "取消屏蔽", "blocks.help": "将解除好友关系、清除待处理申请，并停止双方访问共享练习本及互动。记录会保留。已签发的音频链接可能在到期前仍有效。", "blocks.unblockHelp": "取消屏蔽不会自动恢复好友关系或共享练习本访问权限。", "blocks.empty": "没有已屏蔽的用户。"},
  es: {"blocks.title": "Usuarios bloqueados", "blocks.block": "Bloquear usuario", "blocks.unblock": "Desbloquear", "blocks.help": "Se eliminan la amistad y las solicitudes pendientes y se detienen las interacciones y el acceso de ambos a los cuadernos compartidos. Los registros se conservan. Los enlaces de audio ya emitidos pueden funcionar hasta que caduquen.", "blocks.unblockHelp": "Desbloquear no restaura la amistad ni el acceso a los cuadernos compartidos.", "blocks.empty": "No hay usuarios bloqueados."},
  fr: {"blocks.title": "Utilisateurs bloqués", "blocks.block": "Bloquer cet utilisateur", "blocks.unblock": "Débloquer", "blocks.help": "Supprime le lien d’amitié et les demandes en attente, et arrête les interactions et l’accès aux carnets partagés pour les deux personnes. Les données sont conservées. Les liens audio déjà émis peuvent rester valides jusqu’à expiration.", "blocks.unblockHelp": "Le déblocage ne rétablit pas l’amitié ni l’accès aux carnets partagés.", "blocks.empty": "Aucun utilisateur bloqué."},
  de: {"blocks.title": "Blockierte Nutzer", "blocks.block": "Nutzer blockieren", "blocks.unblock": "Blockierung aufheben", "blocks.help": "Entfernt die Freundschaft und offene Anfragen und beendet Interaktionen sowie den Zugriff beider Personen auf gemeinsame Hefte. Aufzeichnungen bleiben erhalten. Bereits ausgestellte Audiolinks können bis zum Ablauf gültig bleiben.", "blocks.unblockHelp": "Das Aufheben stellt weder die Freundschaft noch den Zugriff auf gemeinsame Hefte wieder her.", "blocks.empty": "Keine blockierten Nutzer."},
  pt: {"blocks.title": "Usuários bloqueados", "blocks.block": "Bloquear usuário", "blocks.unblock": "Desbloquear", "blocks.help": "Remove a amizade e os pedidos pendentes e interrompe as interações e o acesso de ambos aos cadernos compartilhados. Os registros são preservados. Links de áudio já emitidos podem funcionar até expirar.", "blocks.unblockHelp": "Desbloquear não restaura a amizade nem o acesso aos cadernos compartilhados.", "blocks.empty": "Nenhum usuário bloqueado."},
  ru: {"blocks.title": "Заблокированные пользователи", "blocks.block": "Заблокировать пользователя", "blocks.unblock": "Разблокировать", "blocks.help": "Удаляет дружбу и ожидающие запросы, прекращает взаимодействие и доступ обоих пользователей к общим тетрадям. Записи сохраняются. Ранее выданные ссылки на аудио могут действовать до истечения срока.", "blocks.unblockHelp": "Разблокировка не восстанавливает дружбу и доступ к общим тетрадям автоматически.", "blocks.empty": "Нет заблокированных пользователей."},
}
