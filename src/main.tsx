import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './design-system/styles/global.css';
import { router } from './app/router';
import { AuthProvider } from './shared/auth/AuthProvider';
import { DEMO_UI_ONLY, SHOW_DEV_BAR } from './demo/demoMode';

const root = createRoot(document.getElementById('root')!);

// `import.meta.env.DEV` is inlined here so production builds drop this branch and never emit the harness chunks.
if (import.meta.env.MODE === 'staging-sample' && import.meta.env.VITE_STAGING_SAMPLE === 'true') {
  void import('./staging/StagingSampleRoot').then(({ StagingSampleRoot }) => root.render(<StrictMode><StagingSampleRoot /></StrictMode>));
} else if (import.meta.env.DEV && DEMO_UI_ONLY) {
  // Development harness only (dead code in production builds): simulated identity + sample adapter, no backend calls.
  void Promise.all([import('./demo/demoAuthApi'), SHOW_DEV_BAR ? import('./demo/DemoBar') : Promise.resolve(null)]).then(([{ demoAuthApi }, devBar]) => {
    root.render(
      <StrictMode>
        <AuthProvider api={demoAuthApi}>
          <RouterProvider router={router} />
          {devBar && <devBar.DemoBar />}
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
