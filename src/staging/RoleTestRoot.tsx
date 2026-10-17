import { RouterProvider } from 'react-router';
import { router } from '../app/router';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { roleTestAuthApi } from './roleTestAuthApi';

export function RoleTestRoot() {
  return <AuthProvider api={roleTestAuthApi}><RouterProvider router={router} /></AuthProvider>;
}
