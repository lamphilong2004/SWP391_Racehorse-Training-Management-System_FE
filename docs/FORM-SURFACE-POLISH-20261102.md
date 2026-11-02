# Shared form and overlay surfaces — 2026-11-02

Long asked to use frontend styling effectively while keeping the result restrained and suitable for Racehorse.

## Stack and scope

The repository uses React 19, TypeScript, Vite and CSS Modules. package.json and package-lock.json are unchanged. No Bootstrap, Tailwind, animation package, second component framework or extra runtime service is added.

The existing Grid/Flexbox layouts, shared components, navy/emerald tokens and reduced-motion rules remain the foundation. This batch changes only three CSS files: tokens.css, Field.module.css and Overlay.module.css. Prior local WIP is preserved.

## Implemented

- Scoped form labels increase to 13px with 20px line height.
- Inputs receive a clearer neutral border, a restrained hover state and existing emerald keyboard focus.
- Readonly fields have a distinct light surface without being disabled or losing copy/picker semantics.
- Error fields keep red borders and use a red focus halo. Disabled fields retain their existing muted surface and native disabled behavior.
- Helper text uses 18px line height for readability.
- Modal/drawer headers and footers use a pale slate surface; navy headings wrap and their header can grow instead of clipping.
- The close control has a visible border and hover/focus states, 36px minimum desktop target and the existing 44px narrow-screen target.
- Modal body scrolling and footer wrapping remain available. Existing short entry motion and reduced-motion support are preserved.

No field, handler, submit rule, API contract, auth/RBAC decision, clinical state or database record is changed. No commit/push/main merge/deployment.

## Evidence

- 93/93 focused tests across 9 files PASS: shared controls and overlays, field required/error/disabled behavior, PresetField, Stable Care, user forms, Medical and Program creation.
- TypeScript, full ESLint, production build, production bundle guard and diff checks PASS.
- Actual unauthenticated login page: 7 browser checks PASS, including 1440/1280/1024/390 widths, readable labels, bounded input surfaces, native focus/required behavior and reduced-motion. No page error or API request.
- Authenticated form/modal browser verification is BLOCKED in the current runtime. Two attempts wait on login without reaching account pages.
- The same approved account's login request also times out when called directly at BE8080 and via FE5214, each bounded at 10 seconds (10014/10017ms observed). Both health URLs return 200; SQL service is Running. This locates the observed failure beyond browser-only interaction, but does not establish its underlying cause.
- No auth, Backend, SQL service, certificate, password or database change is made to bypass that failure. Do not reuse the earlier seven-role success as verification of this new form/overlay CSS.

Private artifacts: .preview-local/racehorse-training/form-surface-polish-failed.json, form-surface-public.json, form-surface-login.png and form-surface-polish-build.log. Browser credentials are read privately for authorized login attempts; no values, JWTs, headers or cookies are logged. Temporary browsers close in finally blocks.

The prior action/button improvements and their 103-route / seven-role evidence remain recorded separately in ACTION-AFFORDANCE-REVIEW-20261102.md. Current next verification is authenticated form/modal viewing after real login responds; no sample fallback is permitted.
