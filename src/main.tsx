import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './design-system/styles/global.css';
import { router } from './app/router';
import { AuthProvider } from './shared/auth/AuthProvider';

const root = createRoot(document.getElementById('root')!);

// Protected non-production Preview only: the inlined flags let every other build drop the role test login chunk.
if (import.meta.env.MODE === 'staging-preview' && import.meta.env.VITE_ROLE_TEST_LOGIN === 'true') {
  void import('./staging/RoleTestRoot').then(({ RoleTestRoot }) => root.render(<StrictMode><RoleTestRoot /></StrictMode>));
} else {
  root.render(
    <StrictMode>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </StrictMode>,
  );
}
