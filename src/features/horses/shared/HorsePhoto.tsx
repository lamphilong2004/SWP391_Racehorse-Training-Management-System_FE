import { useEffect, useRef, useState } from 'react';
import { Button, HorseAvatar, type HorseAvatarProps } from '../../../design-system';
import { useHorsePhoto } from '../../../shared/horsePhotos';
import styles from './horses.module.css';

/** Same limits as POST /api/horses/{id}/photos (JPEG, PNG or WebP, at most 5 MiB). */
const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function photoProblem(file: File): string | undefined {
  if (!PHOTO_ACCEPT.split(',').includes(file.type)) return 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.';
  if (file.size > PHOTO_MAX_BYTES) return 'Ảnh vượt quá 5 MB. Hãy chọn ảnh nhỏ hơn.';
  return undefined;
}

/** Avatar of a stored horse: newest uploaded photo, or the default artwork when none can be shown. */
export function HorsePhotoAvatar({ horseId, revision, ...props }: Omit<HorseAvatarProps, 'src'> & { horseId: number; revision?: number }) {
  return <HorseAvatar src={useHorsePhoto(horseId, revision)} {...props} />;
}

interface PhotoPickerProps {
  /** Current photo shown before a new file is chosen (object URL of the stored photo). */
  currentSrc?: string | null;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  /** Text under the buttons; the default explains the default artwork. */
  help?: string;
}

/** One-photo chooser with live preview, client-side type/size checks and an explicit default fallback. */
export function HorsePhotoPicker({ currentSrc, file, onChange, disabled, help }: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  // Object URL of the chosen file, created in the change handler and revoked when replaced or unmounted.
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);
  const choose = (next: File | undefined) => {
    if (!next) return;
    const problem = photoProblem(next);
    setError(problem);
    if (problem) return;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(next) : null;
    setPreview(previewRef.current);
    onChange(next);
  };
  return (
    <div className={styles.photoPicker}>
      <div className={styles.photoFrame}><HorseAvatar size="xl" src={(file && preview) || currentSrc} labelDefault /></div>
      <div className={styles.photoPickerBody}>
        <div className={styles.photoActions}>
          <Button type="button" variant="secondary" disabled={disabled} onClick={() => input.current?.click()}>{file || currentSrc ? 'Chọn ảnh khác' : 'Tải ảnh lên'}</Button>
          {file && <Button type="button" variant="tertiary" disabled={disabled} onClick={() => { setError(undefined); onChange(null); }}>Bỏ ảnh đã chọn</Button>}
        </div>
        {file && <p className={styles.photoFileName} title={file.name}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
        <p className={styles.cardHelp}>{help ?? 'JPEG, PNG hoặc WebP, tối đa 5 MB. Không tải ảnh thì hệ thống hiện ảnh minh họa chung.'}</p>
        {error && <p className={styles.photoError} role="alert">{error}</p>}
      </div>
      <input ref={input} className={styles.hiddenInput} type="file" accept={PHOTO_ACCEPT} aria-label="Chọn ảnh đại diện của ngựa"
        onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
