import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './design-system/styles/global.css';
import { router } from './app/router';
import { AuthProvider } from './shared/auth/AuthProvider';
import { DEMO_UI_ONLY } from './demo/demoMode';

const root = createRoot(document.getElementById('root')!);

// `import.meta.env.DEV` is inlined here so production builds drop this branch and never emit the harness chunks.
if (import.meta.env.DEV && DEMO_UI_ONLY) {
  // Development harness only (dead code in production builds): simulated identity + sample adapter, no backend calls.
  void Promise.all([import('./demo/demoAuthApi'), import('./demo/DemoBar')]).then(([{ demoAuthApi }, { DemoBar }]) => {
    root.render(
      <StrictMode>
        <AuthProvider api={demoAuthApi}>
          <RouterProvider router={router} />
          <DemoBar />
        </AuthProvider>
      </StrictMode>,
    );
  });
} else {
  root.render(
    <StrictMode>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </StrictMode>,
  );
}
