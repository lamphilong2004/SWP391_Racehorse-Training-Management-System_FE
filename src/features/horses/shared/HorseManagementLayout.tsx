import { useEffect, useMemo, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router';
import type { BreadcrumbItem } from '../../../design-system';
import { AppShell } from '../../../layout/AppShell';
import { useAuth } from '../../../shared/auth/AuthProvider';
import { HorsesApiProvider } from '../api/HorsesApiContext';
import { createHorsesApi, ApiRequestError } from '../api/horsesApi';
import { ApiError, requestApi } from '../../../shared/auth/authApi';
import { authSession } from '../../../shared/auth/authSession';

interface LayoutContext { setBreadcrumb: (items: BreadcrumbItem[]) => void }
export function HorseManagementLayout() {
  const auth = useAuth();
  const handleApiError = auth.handleApiError;
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ label: 'Horses' }]);
  const context = useMemo<LayoutContext>(() => ({ setBreadcrumb }), []);
  const api = useMemo(() => createHorsesApi({ request: async <T,>(method: 'GET' | 'POST' | 'PUT', path: string, options?: { body?: unknown; query?: Record<string, string | number | undefined> }) => {
    const query = new URLSearchParams();
    Object.entries(options?.query ?? {}).forEach(([key, value]) => { if (value !== undefined) query.set(key, String(value)); });
    const token = authSession.read()?.accessToken;
    if (!token) throw new ApiRequestError(401, 'UNAUTHORIZED', 'Sign in again to view horses.');
    try {
      return await requestApi<T>(path + (query.size ? `?${query}` : ''), { method, ...(options?.body === undefined ? {} : { body: options.body instanceof FormData ? options.body : JSON.stringify(options.body) }) }, { token });
    } catch (error) {
      // A late failure from an old actor must not clear a newly established session.
      if (authSession.read()?.accessToken === token) handleApiError(error);
      if (error instanceof ApiError) throw new ApiRequestError(error.status, error.code, error.message, error.details);
      throw error;
    }
  } }), [handleApiError]);
  if (!auth.user) return null;
  return <HorsesApiProvider api={api}><AppShell user={{ fullName: auth.user.fullName, role: auth.user.roles[0] }} breadcrumb={breadcrumb}><Outlet context={context} /></AppShell></HorsesApiProvider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useBreadcrumb(items: BreadcrumbItem[]) {
  const setBreadcrumb = useOutletContext<LayoutContext | undefined>()?.setBreadcrumb;
  const key = JSON.stringify(items);
  useEffect(() => { setBreadcrumb?.(JSON.parse(key) as BreadcrumbItem[]); }, [setBreadcrumb, key]);
}
