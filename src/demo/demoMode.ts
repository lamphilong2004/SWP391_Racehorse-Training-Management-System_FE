/**
 * DEVELOPMENT HARNESS ONLY (branch feat/dev-ui-harness). Supports UI-first development of the official screens.
 *
 * Active only in the Vite dev server (`import.meta.env.DEV`) AND when explicitly enabled:
 *   npm run dev:harness            (→ `vite --mode harness`)
 *   or VITE_DEMO_UI_ONLY=true in an ignored local .env file.
 * Default: OFF. Production builds have `import.meta.env.DEV === false`, so every harness branch is dead code there.
 *
 * When active, no request reaches a backend: the identity is simulated locally (no JWT is issued) and every `/api/**`
 * business call is answered by the browser-local sample adapter, which follows the approved API contracts.
 */
export const DEMO_UI_ONLY: boolean =
  import.meta.env.DEV && (import.meta.env.MODE === 'harness' || import.meta.env.VITE_DEMO_UI_ONLY === 'true');
