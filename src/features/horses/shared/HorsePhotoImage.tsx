import { useEffect, useRef, useState } from 'react';
import { requestHorsePhoto } from '../../../shared/auth/authApi';
import { authSession } from '../../../shared/auth/authSession';
import defaultPhoto from './horse-default.jpg';
import styles from './horsePhoto.module.css';

/** Shared illustrative photo (CC0, Wikimedia Commons "Chestnut horse against a cloudy sky (Unsplash).jpg"), never presented as the horse itself. */
const DEFAULT_TITLE = 'Ảnh minh họa — ngựa này chưa có ảnh riêng';

export function HorsePhotoImage({ path, name, className, revision = 0, thumbnail = false }: {
  path: string;
  name: string;
  className?: string;
  revision?: number;
  thumbnail?: boolean;
}) {
  const token = authSession.read()?.accessToken;
  const container = useRef<HTMLDivElement>(null);
  const objectUrl = useRef<string | null>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const shouldLoad = !thumbnail || nearViewport || typeof IntersectionObserver === 'undefined';
  const [result, setResult] = useState<{ path: string; token: string; revision: number; url: string | null; failed: boolean }>();
  const current = result?.path === path && result.token === token && result.revision === revision ? result : undefined;

  useEffect(() => {
    if (!thumbnail || !container.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setNearViewport(entry.isIntersecting);
    }, { rootMargin: '80px' });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [thumbnail]);

  // Keep a loaded image while scrolling; release its private URL on identity/revision changes.
  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  }, [path, token, revision]);

  useEffect(() => {
    if (!token || !shouldLoad || current) return;
    const controller = new AbortController();
    let url: string | null = null;
    void requestHorsePhoto(path, token, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      url = blob ? URL.createObjectURL(blob) : null;
      objectUrl.current = url;
      setResult({ path, token, revision, url, failed: false });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ path, token, revision, url: null, failed: true });
    });
    return () => {
      controller.abort();
    };
  }, [path, revision, shouldLoad, token, current]);

  // Settled without a usable photo (none uploaded, no permission, failed load or signed out): show the labelled default.
  const fallback = !current?.url && (Boolean(current) || !token);
  return <div ref={container} className={className ?? (thumbnail ? styles.thumbnail : styles.sessionPhoto)}
    aria-hidden={thumbnail || undefined} title={fallback ? DEFAULT_TITLE : undefined} data-photo-state={current?.url ? 'photo' : fallback ? 'default' : 'loading'}>
    {current?.url ? <img src={current.url} alt={thumbnail ? '' : `Ảnh ${name}`} decoding="async"
      onError={() => setResult({ ...current, url: null, failed: true })} />
      : fallback ? <>
        <img src={defaultPhoto} alt={thumbnail ? '' : `${DEFAULT_TITLE} (${name})`} decoding="async" />
        {!thumbnail && <span className={styles.defaultLabel}>{current?.failed ? 'Không tải được ảnh · ảnh minh họa' : 'Ảnh minh họa'}</span>}
      </>
        : thumbnail ? null : <span>Đang tải ảnh…</span>}
  </div>;
}
