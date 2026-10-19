# Shared v2 foundation

Authority: Long's post-deployment directive and the approved `Racehorse_UI_v2_Equestrian_Command.zip` (Design System v2, UX Playbook v2.1 and tokens). This is an additive shared foundation, not a redesign of owner feature screens or a Figma fidelity Gate.

## Adoption

Import `DesignSystemScope` from `src/design-system` and wrap an owner-reviewed page or region. It applies the single shared `[data-design-system="v2"]` token scope. Existing pages retain the v1 root tokens. Do not create per-flow token sets or apply the scope globally before reviewing affected screens.

- Existing Button variants remain compatible. `danger` aliases `destructive`; `icon` requires an accessible label. Controlled `loading` disables activation while preserving the label and dimensions. The form owner still controls request concurrency and server outcomes.
- Existing fields, Card, DataTable, StatusBadge and Tabs consume compatible token overrides. V2 fields include visible focus/error/disabled states; textarea resizing is vertical. Simulated provenance is purple, distinct from severity.
- `Stack` and `ResponsiveGrid` provide bounded content with three/two/one columns. `table-scroll` is available for narrow tables. These do not replace the existing desktop AppShell or establish mobile completeness across the website.
- Modal/Drawer keep native dialog behavior. Optional `dismissible={false}` disables Close/Escape while the owner provides an explicit finish/discard action. It defaults to true for existing callers. Overlay widths fit narrow viewports.
- `Skeleton` exposes a labelled busy region. `ToastRegion` takes controlled items and deduplicates IDs; it never invents a successful operation. EmptyState and ErrorState remain canonical.
- Motion tokens use 120/180/240 ms. Reduced-motion CSS disables spinner, skeleton, overlay and toast animation. Keyboard focus remains visible.

## Unsaved changes

Mount one `UnsavedChangesGuard dirty={isDirty}` inside a React Router data-router route. It confirms internal navigation and browser Back; Continue editing retains memory state and Discard changes explicitly proceeds. Browser unload uses the native warning, whose display remains browser-dependent. Clear `dirty` only after a confirmed save or explicit discard.

The guard deliberately does not block `/login`, so sign-out/session expiry cannot be trapped. Auth state clears sensitive screens before that redirect. Do not use the guard to persist medical records, passwords, tokens or form content. It writes no storage. Feature owners must review adoption; no Hoang/Duc feature form is automatically changed by this foundation.

## Review and verification

`npm run dev` exposes `/dev/foundation-v2` and the existing `/dev/components` only in development. The review page has component examples, no business sample store or save operation. Normal Production and staging bundles reject these review chunks.

- `node --test scripts/design-system-policy.check.mjs`: token scope, contrast pairs, reduced motion and responsive bounds.
- `src/design-system/components/Foundation/foundation.test.tsx`: controls, overlays, skeleton and controlled feedback.
- `src/design-system/components/UnsavedChangesGuard/UnsavedChangesGuard.test.tsx`: navigation, Back, auth redirect and unload cleanup.
- Browser smoke: v2 primary #2563eb, background #f5f7fb, Inter and 40px controls; dirty navigation retains input; Escape does not discard dirty dialog input; drawer returns focus; duplicate feedback appears once.

Desktop browser checks are bounded to the available 1280x720 browser context. Mobile/reduced-motion behavior has CSS policy evidence, not a claim of complete device or WCAG certification. Existing dev-router `HydrateFallback` warnings were observed; no new browser console error was observed on the component page. Existing feature screens have not been visually migrated to v2.
