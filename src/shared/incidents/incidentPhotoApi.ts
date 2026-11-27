import { ApiError, requestApi, requestProtectedImage } from '../auth/authApi';
import { authSession } from '../auth/authSession';

/** Flow 3 step 3.1: scene photos attached to an incident report (BE: /api/incidents/{id}/photos). */
export const MAX_INCIDENT_PHOTOS = 5;
export const MAX_INCIDENT_PHOTO_BYTES = 5 * 1024 * 1024;
export const INCIDENT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface IncidentPhoto { id: number; uploadedAt: string }

export interface IncidentPhotoApi {
  list(incidentId: number): Promise<IncidentPhoto[]>;
  upload(incidentId: number, file: File): Promise<IncidentPhoto>;
  image(incidentId: number, photoId: number, signal: AbortSignal): Promise<Blob | null>;
}

/** A file the server will refuse anyway is caught before the incident is sent. */
export function photoFileError(file: File): string | null {
  if (!INCIDENT_PHOTO_TYPES.includes(file.type)) return `"${file.name}" không phải ảnh JPEG, PNG hoặc WebP.`;
  if (file.size > MAX_INCIDENT_PHOTO_BYTES) return `"${file.name}" lớn hơn 5 MB.`;
  return null;
}

const positive = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
const readPhoto = (value: unknown): IncidentPhoto => {
  const photo = value as Record<string, unknown> | null;
  if (!photo || !positive(photo.id) || typeof photo.uploadedAt !== 'string' || !Number.isFinite(Date.parse(photo.uploadedAt)))
    throw new ApiError(200, 'INVALID_RESPONSE', 'Dữ liệu ảnh sự cố không hợp lệ.');
  return { id: Number(photo.id), uploadedAt: photo.uploadedAt };
};

/** Reads the session token at call time, like the other Groom APIs, so a host does not have to pass it down. */
export function createIncidentPhotoApi(options: { fetcher?: typeof fetch; baseUrl?: string; handleApiError?: (error: unknown) => boolean } = {}): IncidentPhotoApi {
  function token() {
    const session = authSession.read();
    if (!session || session.expiresAt <= Date.now()) throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.');
    return session.accessToken;
  }
  const path = (incidentId: number) => {
    if (!positive(incidentId)) throw new Error('Mã sự cố không hợp lệ.');
    return `/api/incidents/${incidentId}/photos`;
  };
  async function call<T>(run: () => Promise<T>): Promise<T> {
    try { return await run(); } catch (error) { options.handleApiError?.(error); throw error; }
  }
  return {
    list: (incidentId) => call(async () => {
      const items = await requestApi<unknown>(path(incidentId), { method: 'GET' }, { ...options, token: token() });
      if (!Array.isArray(items)) throw new ApiError(200, 'INVALID_RESPONSE', 'Dữ liệu ảnh sự cố không hợp lệ.');
      return items.map(readPhoto);
    }),
    upload: (incidentId, file) => call(async () => {
      const form = new FormData();
      form.append('file', file);
      return readPhoto(await requestApi<unknown>(path(incidentId), { method: 'POST', body: form }, { ...options, token: token() }));
    }),
    image: (incidentId, photoId, signal) => {
      if (!positive(photoId)) return Promise.reject(new Error('Mã ảnh không hợp lệ.'));
      return requestProtectedImage(`${path(incidentId)}/${photoId}`, token(), signal);
    },
  };
}
