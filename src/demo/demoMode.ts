/**
 * DEVELOPMENT HARNESS ONLY (branch feat/dev-ui-harness). Supports UI-first development of the official screens.
 *
 * Active only in the Vite dev server (`import.meta.env.DEV`) AND when explicitly enabled:
 *   npm run dev:harness   (→ `vite --mode harness`)  developer view: yellow dev bar with role switch and reset
 *   npm run dev:present   (→ `vite --mode present`)  presentation view: official Login with local presentation
 *                                                     accounts, no dev bar and no technical banners
 *   or VITE_DEMO_UI_ONLY=true in an ignored local .env file (developer view).
 * Default: OFF. Production builds have `import.meta.env.DEV === false`, so every harness branch is dead code there.
 *
 * When active, no request reaches a backend: the identity is simulated locally (no JWT is issued) and every `/api/**`
 * business call is answered by the browser-local sample adapter, which follows the approved API contracts.
 */
export const PRESENTATION_MODE: boolean = import.meta.env.DEV && import.meta.env.MODE === 'present';

export const DEMO_UI_ONLY: boolean =
  import.meta.env.DEV && (import.meta.env.MODE === 'harness' || PRESENTATION_MODE || import.meta.env.VITE_DEMO_UI_ONLY === 'true');

/** The developer toolbar is never shown in presentation mode. */
export const SHOW_DEV_BAR: boolean = DEMO_UI_ONLY && !PRESENTATION_MODE;
