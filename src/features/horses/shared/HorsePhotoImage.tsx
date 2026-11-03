import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../design-system';
import { requestHorsePhoto } from '../../../shared/auth/authApi';
import { authSession } from '../../../shared/auth/authSession';
import styles from './horsePhoto.module.css';

export function HorsePhotoImage({ path, name, className, revision = 0, thumbnail = false }: {
  path: string;
  name: string;
  className?: string;
  revision?: number;
  thumbnail?: boolean;
}) {
  const token = authSession.read()?.accessToken;
  const container = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const shouldLoad = !thumbnail || nearViewport || typeof IntersectionObserver === 'undefined';
  const [result, setResult] = useState<{ path: string; token: string; revision: number; url: string | null; failed: boolean }>();
  const current = result?.path === path && result.token === token && result.revision === revision ? result : undefined;

  useEffect(() => {
    if (shouldLoad || !container.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '160px' });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    if (!token || !shouldLoad) return;
    const controller = new AbortController();
    let url: string | null = null;
    void requestHorsePhoto(path, token, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      url = blob ? URL.createObjectURL(blob) : null;
      setResult({ path, token, revision, url, failed: false });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ path, token, revision, url: null, failed: true });
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, revision, shouldLoad, token]);

  return <div ref={container} className={className ?? (thumbnail ? styles.thumbnail : styles.sessionPhoto)}
    aria-hidden={thumbnail || undefined}>
    {current?.url ? <img src={current.url} alt={thumbnail ? '' : `Ảnh ${name}`} decoding="async"
      onError={() => setResult({ ...current, url: null, failed: true })} />
      : thumbnail ? <Icon name="image" size={18} />
        : <span>{current?.failed ? 'Không tải được ảnh' : current ? 'Chưa có ảnh' : token ? 'Đang tải ảnh…' : 'Chưa có ảnh'}</span>}
  </div>;
}
