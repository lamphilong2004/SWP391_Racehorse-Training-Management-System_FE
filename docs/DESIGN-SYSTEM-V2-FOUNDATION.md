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

## Shared adoption contract for Long, Hoang and Duc

Use the existing `src/design-system/index.ts` barrel. Component props remain compatible with current feature callers. Owner adoption is a separate screen review, not a reason to copy CSS or fork shared controls.

| Surface | Existing v1 | Opt-in v2 |
|---|---|---|
| Primary / canvas | #2f6dd9 / #f7f8fa | #2563eb / #f5f7fb |
| Small / medium / large Button | 32 / 40 / 48px | 36 / 40 / 48px; narrow-web minimum44px |
| Input / Select | 40px | 40px; narrow-web minimum44px |
| Card radius | 8px (legacy radius-md) | 14px |
| DataTable row | 56px | 48px |
| TextArea | minimum72px, fixed resize | minimum96px, vertical resize |
| Type hierarchy | Inter, current semantic classes | Same hierarchy; tabular numbers for metrics/time |

- Long owns shared tokens/controls/navigation integration. Wrap a reviewed region in `DesignSystemScope`; wrapping only page content intentionally does not retheme an AppShell outside that region. A later whole-shell migration needs its own combined screen review.
- Hoang and Duc keep their feature ownership. Reuse these controls in allocated screens; report missing shared behavior instead of changing shared tokens independently. CORE-050 FE remains unassigned.
- Forms: use canonical TextField/SelectField/TextAreaField/RadioGroup and explicit labels/errors. Keep `dirty` in component memory. On submit, use the canonical real API client, prevent concurrent requests in the owner controller, set `loading={pending}`, retain the draft on errors and clear dirty only after a confirmed response or explicit discard.
- Dirty/pending dialogs: set `dismissible={false}` and provide an explicit finish/discard control. Native focus trapping and restoration remain active. Backdrop dismissal is not enabled by this foundation. Do not close a failed edit as if it saved.
- Notifications: pass confirmed feedback to `ToastRegion` with a stable operation ID and an explicit dismiss handler. Form validation stays inline. A success tone is not permission to infer that a write happened.
- Tables: keep a real caption/column labels and the existing server pagination/filter contract. Put wide tables in a labelled, keyboard-focusable `table-scroll` region. Never synthesize totals or shorten clinical content without an accessible full view.
- Layout/motion: use Stack/ResponsiveGrid and the canonical tokens. Check keyboard Tab/Shift+Tab, tab arrows, Escape and reduced motion. Work Rider actions that require48px use the existing large size; this foundation does not silently resize owner feature actions or replace mobile navigation.

Before a screen adoption PR, verify its v1 neighbors are unchanged, authorized API/row scope remains intact, dirty/error/retry behavior works, and no success message appears before a real acknowledgement. No sample transport, preview identity or developer gallery belongs in a Production screen.

## Review and verification

`npm run dev` exposes `/dev/foundation-v2` and the existing `/dev/components` only in development. The review page has component examples, no business sample store or save operation. Normal Production and staging bundles reject these review chunks.

- `node --test scripts/design-system-policy.check.mjs`: token scope, contrast pairs, reduced motion and responsive bounds.
- `src/design-system/components/Foundation/foundation.test.tsx`: controls, overlays, skeleton and controlled feedback.
- `src/design-system/components/UnsavedChangesGuard/UnsavedChangesGuard.test.tsx`: navigation, Back, auth redirect and unload cleanup.
- Browser smoke: v2 primary #2563eb, background #f5f7fb, Inter and 40px controls; dirty navigation retains input; Escape does not discard dirty dialog input; drawer returns focus; duplicate feedback appears once.

Final isolated Chromium checks cover1440x900,1280x800,1024x768,768x1024 and375x812. The shared grid has3/3/2/2/1 columns, with no horizontal document overflow; modal/drawer and unsaved-confirmation actions fit. Keyboard focus, dirty overlays, toast suppression, tab arrows/Home and reduced-motion skeleton/spinner were exercised without mocks or Backend requests. Legacy gallery retains its v1 root/background and has no v2 scope. A real selector-precedence issue found in this check was fixed inside v2: its keyboard outline now outranks the legacy field focus reset. No assertion or security control was weakened.

This is component-foundation coverage, not complete-device or WCAG certification of every feature screen. The existing AppShell remains desktop-first. Existing dev-router `HydrateFallback` warnings were observed; no page error was observed in the final isolated browser run. Existing feature screens have not been visually migrated to v2.
