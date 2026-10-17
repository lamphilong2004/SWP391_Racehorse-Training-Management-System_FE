import { RouterProvider } from 'react-router';
import { router } from '../app/router';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { stagingAuthApi } from './stagingAuthApi';

export function StagingSampleRoot() {
  return <AuthProvider api={stagingAuthApi}><RouterProvider router={router} /></AuthProvider>;
}
