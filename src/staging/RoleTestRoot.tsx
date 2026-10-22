import { RouterProvider } from 'react-router';
import { router } from '../app/router';
import { AuthProvider } from '../shared/auth/AuthProvider';
import { roleTestAuthApi } from './roleTestAuthApi';
import { NotificationsProvider } from '../shared/notifications/NotificationsProvider';

export function RoleTestRoot() {
  return <AuthProvider api={roleTestAuthApi}><NotificationsProvider><RouterProvider router={router} /></NotificationsProvider></AuthProvider>;
}
