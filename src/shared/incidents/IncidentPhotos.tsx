import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertBanner, Button, Icon, Modal } from '../../design-system';
import { MAX_INCIDENT_PHOTOS, photoFileError, type IncidentPhoto, type IncidentPhotoApi } from './incidentPhotoApi';
import styles from './IncidentPhotos.module.css';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const objectUrl = (blob: Blob) => typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : '';
const release = (url: string) => { if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url); };
const shotTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

/** Splits a picked list into the files that can be added and the message for the rest. */
function accept(picked: File[], room: number): { files: File[]; error: string } {
  const valid = picked.filter((file) => !photoFileError(file));
  const invalid = picked.map(photoFileError).find(Boolean);
  const over = valid.length > room ? `Mỗi sự cố có tối đa ${MAX_INCIDENT_PHOTOS} ảnh.` : '';
  return { files: valid.slice(0, Math.max(room, 0)), error: invalid ?? over };
}

/** Photos chosen in the report form. Nothing is sent until the incident itself is created. */
export function IncidentPhotoPicker({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null), hintId = useId();
  const [error, setError] = useState('');
  const previews = useMemo(() => files.map(objectUrl), [files]);
  useEffect(() => () => previews.forEach(release), [previews]);
  const room = MAX_INCIDENT_PHOTOS - files.length;
  function pick(list: FileList | null) {
    const result = accept([...(list ?? [])], room);
    setError(result.error);
    if (result.files.length) onChange([...files, ...result.files]);
    if (input.current) input.current.value = '';
  }
  return <div className={styles.picker}>
    <div className={styles.pickerHead}>
      <span className={styles.label}>Ảnh hiện trường</span>
      <span id={hintId} className={styles.hint}>Không bắt buộc · tối đa {MAX_INCIDENT_PHOTOS} ảnh JPEG, PNG, WebP, mỗi ảnh ≤ 5 MB</span>
    </div>
    <div className={styles.thumbs}>
      {files.map((file, index) => <figure key={`${file.name}:${file.size}:${file.lastModified}:${index}`} className={styles.thumb}>
        {previews[index] ? <img src={previews[index]} alt={`Ảnh ${index + 1}: ${file.name}`} /> : <span className={styles.thumbName}>{file.name}</span>}
        <button type="button" className={styles.remove} disabled={disabled} aria-label={`Bỏ ảnh ${index + 1} (${file.name})`}
          onClick={() => { setError(''); onChange(files.filter((_, at) => at !== index)); }}><Icon name="x" size={14} /></button>
      </figure>)}
      {room > 0 && <button type="button" className={styles.addTile} disabled={disabled} aria-describedby={hintId} onClick={() => input.current?.click()}>
        <Icon name="image" size={20} /><span>{files.length ? 'Thêm ảnh' : 'Chọn ảnh'}</span></button>}
    </div>
    <input ref={input} type="file" accept={ACCEPT} multiple hidden aria-label="Chọn ảnh hiện trường" disabled={disabled} onChange={(event) => pick(event.target.files)} />
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
}

function PhotoThumb({ api, incidentId, photo, index, onOpen }: { api: IncidentPhotoApi; incidentId: number; photo: IncidentPhoto; index: number; onOpen: (url: string) => void }) {
  const [state, setState] = useState<{ url?: string; failed?: boolean }>({});
  useEffect(() => {
    const controller = new AbortController();
    let url = '';
    api.image(incidentId, photo.id, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      url = blob ? objectUrl(blob) : '';
      setState(url ? { url } : { failed: true });
    }).catch(() => { if (!controller.signal.aborted) setState({ failed: true }); });
    return () => { controller.abort(); release(url); };
  }, [api, incidentId, photo.id]);
  const label = `Ảnh ${index + 1}, chụp lúc ${shotTime(photo.uploadedAt)}`;
  return <figure className={styles.thumb} data-photo-id={photo.id}>
    {state.url ? <button type="button" className={styles.open} aria-label={`Xem lớn ${label}`} onClick={() => onOpen(state.url!)}><img src={state.url} alt={label} /></button>
      : <span className={styles.thumbName}>{state.failed ? 'Không tải được ảnh' : 'Đang tải…'}</span>}
    <figcaption>{shotTime(photo.uploadedAt)}</figcaption>
  </figure>;
}

/** Incident detail: everyone who can read the incident sees the photos; the reporter may add more until it is closed. */
export function IncidentPhotoGallery({ api, incidentId, canAdd }: { api: IncidentPhotoApi; incidentId: number; canAdd: boolean }) {
  const [photos, setPhotos] = useState<IncidentPhoto[]>(), [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [large, setLarge] = useState<string>();
  const input = useRef<HTMLInputElement>(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(() => {
    api.list(incidentId).then((items) => { if (mounted.current) { setLoadError(false); setPhotos(items); } }, () => { if (mounted.current) setLoadError(true); });
  }, [api, incidentId]);
  useEffect(load, [load]);
  const room = MAX_INCIDENT_PHOTOS - (photos?.length ?? MAX_INCIDENT_PHOTOS);
  // After the first load, a failed refresh keeps the last known photos but must be visible: the count may be stale,
  // so adding is paused until the list is read again (never ask the user to upload the same evidence twice).
  const refreshFailed = photos !== undefined && loadError;
  async function add(list: FileList | null) {
    const result = accept([...(list ?? [])], room);
    if (input.current) input.current.value = '';
    setError(result.error);
    if (!result.files.length) return;
    let failed = 0;
    const saved: IncidentPhoto[] = [];
    for (const [index, file] of result.files.entries()) {
      if (!mounted.current) return;
      setBusy(`Đang tải ảnh ${index + 1}/${result.files.length}…`);
      try { saved.push(await api.upload(incidentId, file)); } catch { failed += 1; }
    }
    if (!mounted.current) return;
    setBusy('');
    // The server confirmed these photos: show them now, even if the read-back below fails.
    if (saved.length) setPhotos((current) => [...(current ?? []), ...saved.filter((photo) => !current?.some((item) => item.id === photo.id))]);
    if (failed) setError(`${failed} ảnh chưa tải lên được. Hãy thử lại.`);
    load();
  }
  return <div className={styles.gallery}>
    {photos === undefined ? loadError
      ? <AlertBanner type="warning" title="Không tải được ảnh hiện trường."><Button size="sm" variant="secondary" onClick={load}>Thử lại</Button></AlertBanner>
      : <p className={styles.hint}>Đang tải ảnh…</p>
      : <>
        {photos.length ? <div className={styles.thumbs}>{photos.map((photo, index) => <PhotoThumb key={photo.id} api={api} incidentId={incidentId} photo={photo} index={index} onOpen={setLarge} />)}</div>
          : <p className={styles.hint}>Chưa có ảnh nào.</p>}
        {refreshFailed && <AlertBanner type="warning" title="Không tải lại được danh sách ảnh.">
          <p>Ảnh đã tải lên vẫn được lưu. Bấm Thử lại để xem danh sách mới nhất, không cần tải ảnh lại.</p>
          <Button size="sm" variant="secondary" onClick={load}>Thử lại</Button></AlertBanner>}
        {canAdd && room > 0 && !refreshFailed && <div className={styles.addRow}>
          <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => input.current?.click()}><Icon name="image" size={16} />{busy || 'Thêm ảnh'}</Button>
          <span className={styles.hint}>Còn thêm được {room} ảnh · JPEG, PNG, WebP ≤ 5 MB</span>
          <input ref={input} type="file" accept={ACCEPT} multiple hidden aria-label="Chọn ảnh hiện trường" onChange={(event) => void add(event.target.files)} />
        </div>}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </>}
    <Modal open={Boolean(large)} title="Ảnh hiện trường" size="lg" onClose={() => setLarge(undefined)}>
      {large && <img className={styles.large} src={large} alt="Ảnh hiện trường cỡ lớn" />}
    </Modal>
  </div>;
}
