import type { CurrentUser } from '../auth/authApi';

export type MedicalDataSource = 'api' | 'demo';

/** One source for the connected Case/Incident/Treatment/Groom graph; auth remains canonical HTTP. */
export function medicalDataSource(): MedicalDataSource {
  const source = import.meta.env.VITE_MEDICAL_DATA_SOURCE ?? 'api';
  if (source !== 'api' && source !== 'demo') throw new Error('VITE_MEDICAL_DATA_SOURCE must be api or demo.');
  return source;
}

export function createMedicalTransport(actor?: CurrentUser): typeof fetch {
  const source = medicalDataSource();
  if (source === 'api') return (input, init) => fetch(input, init);
  return async (input, init) => {
    if (!actor || actor.accountStatus !== 'ACTIVE') {
      return new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sign in with an active backend account to use the demo.', details: [] } }), { status: 401 });
    }
    const headers = new Headers(init?.headers);
    headers.delete('Authorization');
    // This module has no auth endpoints and does not receive or persist the real JWT.
    const { createMedicalDemoFetch } = await import('../../mocks/medicalDemo');
    return createMedicalDemoFetch(actor)(input, { ...init, headers });
  };
}
