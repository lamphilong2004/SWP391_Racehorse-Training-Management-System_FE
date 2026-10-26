import { useEffect, useState } from 'react';
import { requestApi, requestApiBlob } from './auth/authApi';
import { authSession } from './auth/authSession';

interface HorsePhoto { id: number; url: string; uploadedAt: string }

/**
 * Newest photo per horse (GET /api/horses/{id}/photos is newest first) as an in-memory object URL.
 * The cache belongs to one access token: a new sign-in drops and revokes every URL of the previous session.
 * No photo, no permission (Work Rider, Horse Owner) or an unavailable file all resolve to null → default artwork.
 */
const cache = new Map<number, Promise<string | null>>();
let cacheToken: string | undefined;

function revoke(entry: Promise<string | null> | undefined) {
  void entry?.then((url) => { if (url) URL.revokeObjectURL(url); });
}

export function loadHorsePhoto(horseId: number): Promise<string | null> {
  const token = authSession.read()?.accessToken;
  if (!token || !Number.isSafeInteger(horseId) || horseId < 1 || typeof URL.createObjectURL !== 'function') return Promise.resolve(null);
  if (token !== cacheToken) { cache.forEach(revoke); cache.clear(); cacheToken = token; }
  const cached = cache.get(horseId);
  if (cached) return cached;
  const entry = requestApi<HorsePhoto[]>(`/api/horses/${horseId}/photos`, { method: 'GET' }, { token })
    .then(async (photos) => (photos[0] ? URL.createObjectURL(await requestApiBlob(photos[0].url, token)) : null))
    .catch(() => { cache.delete(horseId); return null; });
  cache.set(horseId, entry);
  return entry;
}

/** Call after a new photo is uploaded so the next render loads the newest one. */
export function forgetHorsePhoto(horseId: number) {
  revoke(cache.get(horseId));
  cache.delete(horseId);
}

export function useHorsePhoto(horseId: number | null | undefined, revision = 0): string | null {
  const [state, setState] = useState<{ key: string; url: string | null }>({ key: '', url: null });
  const key = `${horseId ?? ''}:${revision}`;
  useEffect(() => {
    if (!horseId) return;
    let active = true;
    void loadHorsePhoto(horseId).then((url) => { if (active) setState({ key, url }); });
    return () => { active = false; };
  }, [horseId, key]);
  return state.key === key ? state.url : null;
}
