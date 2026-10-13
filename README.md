# SWP391_Racehorse-Training-Management-System_FE

Frontend of the Racehorse Training & Management System: React 19 + TypeScript + Vite + React Router.

## Run

Requires Node.js ≥ 22.13.

```bash
npm install
npm run dev        # http://localhost:5173 → /dev/components (dev only)
npm run lint
npm run typecheck
npm test
npm run build
```

## Structure

```text
src/
  app/            router + ROUTES (single source of route paths)
  design-system/  canonical shared Figma Design System (CORE-002, DEC-010) — import from 'src/design-system'
    styles/       tokens.css (Figma variables), typography.css (Inter scale + Landing/Display), global.css
    icons/        Figma icon set (69:6) + <Icon>
    components/   see the props table below
  layout/         AppShell (Sidebar 240 + Header 64 + content), navigation.ts (canonical nav config), PageHeader
  shared/auth/    the 7 RBAC role codes (CORE-003 contract)
  pages/dev/      DEV-ONLY component gallery and shell preview (not registered or bundled in production)
```

## Design System rules

- Visual source of truth: Figma file `tm7dpgAQbHReZ7tlQeQJlc` (page **01 - Design System**, screens on **04 - Full Product Screens**, landing on **00 - Product Showcase & Entry**).
- Use the tokens (`var(--color-…)`, `var(--space-…)`, `var(--radius-…)`, `var(--elev-…)`) and the `text-*` classes. No raw hex values, no local font sizes.
- `text-landing-display-xl|l|m` (Instrument Serif) are for the public landing/login pages only.
- Never create a second component system (`Button2`, `CustomSidebar`, `MyBadge`, local modal/drawer…). If a component is missing, extend `src/design-system` first (owner: Trần Khải Hoàng).
- Business statuses come only from `STATUS_REGISTRY` (`<StatusBadge family="availability" status="LOCKED" />`). Status is never colour alone.
- Screens render inside `<AppShell>`; the sidebar is role-filtered (absent, never disabled). Frontend role checks are usability only — the backend enforces RBAC and row scope.
- Out-of-scope modules stay in `src/layout/navigation.ts` with a `deferred` reason and are filtered out by `visibleSections()`. Remove the flag when the module enters scope.
- Every data region shows `LoadingState` / `EmptyState` / `ErrorState`.
- Route paths live in `src/app/routePaths.ts`. Paths other than `/dashboard` and `/reports/*` are provisional until the sitemap is shared.
- Dev only: `/dev/components` shows every token and component; `/dev/shell/:role` shows the shell for each of the 7 roles.

## Component API

All exported from `src/design-system`.

| Component | Key props | Figma |
|---|---|---|
| `Button` | `variant` primary · secondary · tertiary · destructive, `size` sm · md · lg, native button props | 6:28 |
| `TextField` | `label`, `helperText`, `error`, native input props | 7:22 |
| `SelectField` | `label`, `options: {value,label}[]`, `placeholder`, `helperText`, `error` | 7:47 |
| `Checkbox` | `label`, native checkbox props (`checked`, `defaultChecked`, `disabled`, `onChange`) | 327:6160 / 409:62 |
| `StatusBadge` | `family` (availability · session · realtime · simulated · program · health · preventive · incident · lifecycle · account), `status` | 69:151 … 238:9700 |
| `AlertBanner` | `type` info · success · warning · danger · simulated, `title`, `children` | 70:26 |
| `ValidationNotice` | `category` a · b · c · d, `title`, `children`, `meta`, `lockNote` (a), `actions` | 70:138 |
| `Card` | `title`, `action`, `children` | 71:51 |
| `MetricCard` | `label`, `value`, `caption`, `captionIcon`, `captionTone`, `realtimeState` normal · warning · critical | 71:60 |
| `KeyValue` | `label`, `value` | 71:102 |
| `Tabs` | `items`, `value`, `onChange`, `label` | 71:108 |
| `Breadcrumb` | `items: {label, to?}[]` | 71:123 |
| `WizardStepper` | `steps`, `currentStep`, `onStepClick` (completed steps only) | 73:63 |
| `DataTable` | `columns: {key, header, render, width?, align?}[]`, `rows`, `rowKey`, `onRowClick`, `selectedKey`, `empty` | 73:117 |
| `ChartContainer` | `title`, `seriesLabel`, `values`, `yTicks`, `xLabels`, `threshold {value,label}`, `emptyTitle`, `emptyDescription` | 73:272 |
| `Modal` | `open`, `onClose`, `title`, `size` md · lg, `footer`, `children` | 75:235 |
| `Drawer` | `open`, `onClose`, `title`, `subtitle`, `footer`, `children` | 75:267 |
| `HorseCard` | `name`, `meta`, `availability`, `facts: {label,value}[]`, `action` | 75:360 |
| `CandidateCard` | `name`, `subtitle`, `tags`, `facts: {label,value}[]` (no scores), `actions` | 75:418 |
| `PhotoAttachmentTile` | `state` empty (`onAdd`) · attached (`fileName`, `onRemove`) | 239:499 |
| `StableBoxTile` | `boxId`, `state` free · occupied · selected, `horseName`, `onSelect` | 239:539 |
| `NotificationItem` | `title`, `body`, `context`, `time`, `read`, `icon`, `onClick` | 239:566 |
| `EmptyState` | `title`, `description` | 329:6273 |
| `LoadingState` | `label` | EmptyState container (no dedicated frame) |
| `ErrorState` | `title`, `description`, `onRetry`, `retryLabel` | Danger banner 70:50 + Button (no dedicated frame) |
| `Icon` | `name` (41 Figma icons), `size`, `label` | 69:6 |
| `AppShell` (layout) | `user {fullName, role}`, `breadcrumb`, `searchPlaceholder`, `unreadCount`, callbacks, `children` | 74:110 · 74:367 |
| `PageHeader` (layout) | `title`, `description`, `actions` | 288:3298 |
