import type { RouteObject } from 'react-router';
import { PublicOnly } from '../../app/RequireAuth';
import { ForgotPasswordPage, ResetPasswordPage } from './PasswordResetPages';
import { RegisterPage } from './RegisterPage';
import { RegistrationReviewPage } from './RegistrationReviewPage';

// Proposed feature entries for Integration Owner review, not registered in the shared router here.
export const registrationRoutes: RouteObject[] = [
  { path: '/register', element: <PublicOnly><RegisterPage /></PublicOnly> },
  { path: '/forgot-password', element: <PublicOnly><ForgotPasswordPage /></PublicOnly> },
  { path: '/reset-password', element: <PublicOnly><ResetPasswordPage /></PublicOnly> },
  { path: '/admin/registrations', element: <RegistrationReviewPage /> },
];
