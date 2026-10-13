# SWP391_Racehorse-Training-Management-System_FE

Frontend of the Racehorse Training & Management System: React 19 + TypeScript + Vite + React Router.

## Run

Requires Node.js ≥ 22.13.

```bash
npm install
npm run dev        # http://localhost:5173 → /design-system
npm run lint
npm run typecheck
npm test
npm run build
```

## Structure

```text
src/
  app/            router + ROUTES (single source of route paths)
  design-system/  shared Figma Design System (CORE-002) — import from 'src/design-system'
    styles/       tokens.css (Figma variables), typography.css, global.css
    icons/        Figma icon set (69:6) + <Icon>
    components/   Button, TextField, SelectField, StatusBadge, AlertBanner, Card, MetricCard, KeyValue,
                  Tabs, Breadcrumb, WizardStepper, DataTable, EmptyState, Modal, Drawer
  layout/         AppShell (Sidebar 240 + Header 64 + content), role navigation, PageHeader
  shared/auth/    the 7 RBAC role codes (CORE-003 contract)
  pages/          design-system reference pages
```

## Design System rules

- Visual source of truth: Figma file `tm7dpgAQbHReZ7tlQeQJlc` (page **01 - Design System**, screens on **04 - Full Product Screens**).
- Use the tokens (`var(--color-…)`, `var(--space-…)`, `var(--radius-…)`, `var(--elev-…)`) and the `text-*` classes. No raw hex values, no local font sizes.
- Never create a second component system (`Button2`, `CustomSidebar`, `MyBadge`, local modal/drawer…). If a component is missing, extend `src/design-system` first (owner: Trần Khải Hoàng).
- Business statuses come only from `STATUS_REGISTRY` (`<StatusBadge family="availability" status="LOCKED" />`). Status is never colour alone.
- Screens render inside `<AppShell>`; the sidebar is role-filtered (absent, never disabled). Frontend role checks are usability only — the backend enforces RBAC and row scope.
- Route paths live in `src/app/routePaths.ts`. Paths other than `/dashboard` and `/reports/*` are provisional until the sitemap is shared.
- `/design-system` shows every token and component; `/design-system/shell/:role` shows the shell for each of the 7 roles.
