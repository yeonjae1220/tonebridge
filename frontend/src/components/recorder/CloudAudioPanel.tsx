 'use client'
import { useEffect, useState, useRef } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { recordingDrafts, type RecordingDraftSnapshot } from '@/lib/recordingDrafts'
import { cloudBindings, type CloudSettings } from '@/lib/cloudDraftLocal'
import { selectCloudRecording, uploadCloudRecording, downloadCloudRecording } from '@/lib/cloudAudioSync'
import { downloadDraftBlob } from './DraftExportButton'
const messages = {
  ko: ['녹음 초안', '녹음 동기화 켜기', '녹음 동기화 중단', '완료된 녹음만 동기화합니다. 기존 녹음은 선택한 것만, 동의 후 새 녹음은 자동으로 올립니다. 파일당 50MB·계정당 이력 포함 100MB, 텍스트와 합쳐 초안 50개까지입니다. 중단해도 서버 사본은 남습니다.', '선택한 녹음 올리기', '녹음 재생', '녹음 다운로드', '녹음 작업을 완료하지 못했습니다. 로컬 녹음은 유지됩니다. 다시 시도해 주세요.'],
  en: ['Audio drafts', 'Enable audio sync', 'Stop audio sync', 'Only completed recordings sync. Choose existing recordings; new recordings upload after consent. 50 MB per file, 100 MB per account including history, 50 drafts shared with text. Stopping sync keeps cloud copies.', 'Upload selected recordings', 'Play recording', 'Download recording', 'Audio action failed. Local recordings are preserved. Please retry.'],
  ja: ['録音の下書き','録音同期を有効化','録音同期を停止','完了した録音のみ同期します。既存の録音は選択し、同意後の新しい録音は自動送信します。1ファイル50MB、履歴込み100MB、テキストと合計50件。停止後もクラウドのコピーは残ります。','選択した録音を送信','録音を再生','録音をダウンロード','操作に失敗しました。端末の録音は保持されています。再試行してください。'],
  zh: ['录音草稿','开启录音同步','停止录音同步','仅同步已完成的录音。现有录音需选择，同意后的新录音自动上传。每文件50MB，含历史每账户100MB，与文本合计50份草稿。停止同步保留云端副本。','上传选中录音','播放录音','下载录音','操作失败。本地录音已保留，请重试。'],
  es: ['Borradores de audio','Activar sincronización de audio','Detener sincronización de audio','Solo grabaciones terminadas. Selecciona las existentes; las nuevas se suben tras el consentimiento. 50 MB por archivo, 100 MB con historial y 50 borradores junto con texto. Detener conserva las copias.','Subir grabaciones seleccionadas','Reproducir grabación','Descargar grabación','La operación falló. Las grabaciones locales se conservan. Reinténtalo.'],
  fr: ['Brouillons audio','Activer la synchronisation audio','Arrêter la synchronisation audio','Uniquement les enregistrements terminés. Sélectionnez les anciens ; les nouveaux sont envoyés après consentement. 50 Mo par fichier, 100 Mo avec historique et 50 brouillons avec le texte. Les copies sont conservées après arrêt.','Envoyer les enregistrements sélectionnés','Lire l’enregistrement','Télécharger l’enregistrement','Échec. Les enregistrements locaux sont conservés. Réessayez.'],
  de: ['Audioentwürfe','Audiosynchronisierung aktivieren','Audiosynchronisierung stoppen','Nur abgeschlossene Aufnahmen. Bestehende auswählen; neue werden nach Zustimmung hochgeladen. 50 MB je Datei, 100 MB einschließlich Verlauf, zusammen mit Text 50 Entwürfe. Stoppen behält Cloudkopien.','Ausgewählte Aufnahmen hochladen','Aufnahme abspielen','Aufnahme herunterladen','Aktion fehlgeschlagen. Lokale Aufnahmen bleiben erhalten. Erneut versuchen.'],
  pt: ['Rascunhos de áudio','Ativar sincronização de áudio','Parar sincronização de áudio','Apenas gravações concluídas. Selecione as existentes; novas são enviadas após consentimento. 50 MB por arquivo, 100 MB com histórico e 50 rascunhos junto com texto. Parar mantém as cópias.','Enviar gravações selecionadas','Reproduzir gravação','Baixar gravação','A operação falhou. Gravações locais preservadas. Tente novamente.'],
  ru: ['Аудиочерновики','Включить синхронизацию аудио','Остановить синхронизацию аудио','Только завершённые записи. Старые выберите вручную; новые загружаются после согласия. До 50 МБ на файл, 100 МБ с историей и 50 черновиков вместе с текстом. Остановка сохраняет облачные копии.','Загрузить выбранные записи','Воспроизвести запись','Скачать запись','Ошибка операции. Локальные записи сохранены. Повторите попытку.'],
}
export function useAudioMessages() { const { language } = useI18n(); return messages[language as keyof typeof messages] ?? messages.en }
export function CloudAudioPanel({ owner, settings, disabled, change }: { owner: string; settings: CloudSettings; disabled: boolean; change: () => void }) {
  const m = useAudioMessages(), [sources, setSources] = useState<RecordingDraftSnapshot[]>([]), [selected, setSelected] = useState<string[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(false)
  useEffect(() => {
    let live = true
    const refresh = () => { void recordingDrafts.list(owner).then(rows => { if (live) setSources(rows.filter(row => !row.draft.interrupted && !cloudBindings(owner)['audio:' + row.scope])) }).catch(() => { if (live) setError(true) }) }
    refresh(); const stop = recordingDrafts.subscribe(refresh)
    window.addEventListener('tonebridge-cloud-change', refresh)
    return () => { live = false; stop(); window.removeEventListener('tonebridge-cloud-change', refresh) }
  }, [owner])
  const upload = async () => {
    if (busy) return
    setBusy(true); setError(false)
    try { for (const row of sources.filter(source => selected.includes(source.scope))) { await selectCloudRecording(owner, row, settings); await uploadCloudRecording(owner, 'audio:' + row.scope) }; setSelected([]) }
    catch { setError(true) } finally { setBusy(false) }
  }
  return <section className="space-y-3 rounded-xl border p-4" data-testid="cloud-audio-panel"><h2 className="font-bold">{m[0]}</h2><p className="text-sm">{m[3]}</p>
    <button className="min-h-11 rounded border px-3 disabled:opacity-40" disabled={disabled || busy || !settings.enabled} onClick={change}>{settings.audioEnabled ? m[2] : m[1]}</button>
    {sources.map(row => <label key={row.id} className="flex gap-3"><input type="checkbox" disabled={disabled || busy || !settings.audioEnabled} checked={selected.includes(row.scope)} onChange={e => setSelected(old => e.target.checked ? [...old, row.scope] : old.filter(v => v !== row.scope))} /><span>{Math.round(row.draft.duration)}s · {(row.draft.blob.size / 1048576).toFixed(1)} MB · {new Date(row.updatedAt).toLocaleString()}</span></label>)}
    <button className="min-h-11 rounded border px-3 disabled:opacity-40" disabled={disabled || busy || !settings.audioEnabled || !selected.length} onClick={() => void upload()}>{m[4]}</button>{error && <p role="alert">{m[7]}</p>}
  </section>
}
export function CloudAudioPlayer({ owner, asset }: { owner: string; asset: string }) {
  const m = useAudioMessages(), [url, setUrl] = useState<string>(), [busy, setBusy] = useState(false), [error, setError] = useState(false)
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  const read = async (download: boolean) => {
    if (busy) return
    setBusy(true); setError(false)
    try { const { blob } = await downloadCloudRecording(owner, asset); if (!live.current) return; if (download) downloadDraftBlob(blob, 'tonebridge-recording.' + (blob.type === 'audio/mp4' ? 'm4a' : blob.type.split('/')[1])); else setUrl(URL.createObjectURL(blob)) }
    catch { if (live.current) setError(true) } finally { if (live.current) setBusy(false) }
  }
  return <div className="space-y-2"><div className="flex gap-2"><button className="min-h-11 rounded border px-3" disabled={busy} onClick={() => void read(false)}>{m[5]}</button><button className="min-h-11 rounded border px-3" disabled={busy} onClick={() => void read(true)}>{m[6]}</button></div>{url && <audio controls src={url} />}{error && <p role="alert">{m[7]}</p>}</div>
}
