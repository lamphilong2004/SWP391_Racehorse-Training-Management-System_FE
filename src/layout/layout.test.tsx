import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ROUTES } from '../app/routePaths';
import { ICON_NAMES } from '../design-system/icons/iconNames';
import { ROLE_CODES, ROLE_LABELS } from '../shared/auth/roles';
import { AppShell } from './AppShell';
import { NAVIGATION, visibleSections, withoutDeferred } from './navigation';
import type { RoleCode } from '../shared/auth/roles';

/** Deferred modules per the CORE-002 DoD (DEC-007, DEC-008 §3.5). */
const DEFERRED_BY_ROLE: Partial<Record<RoleCode, string[]>> = {
  CLUB_MANAGER: ['Stable', 'Races', 'Inventory', 'Reports'],
  HEAD_TRAINER: ['Races'],
  VETERINARIAN: ['Preventive Healthcare'],
  GROOM: ['Care Tasks', 'Daily Care', 'Preventive Healthcare'],
};

describe('deferred sidebar modules', () => {
  it('flags exactly the deferred modules in the navigation config', () => {
    for (const role of ROLE_CODES) {
      const deferred = NAVIGATION[role].sections
        .flatMap((section) => section.items)
        .filter((item) => item.deferred)
        .map((item) => item.label);
      expect(deferred).toEqual(DEFERRED_BY_ROLE[role] ?? []);
    }
  });

  it.each(Object.entries(DEFERRED_BY_ROLE) as Array<[RoleCode, string[]]>)(
    'does not render the deferred modules for %s',
    (role, labels) => {
      render(
        <MemoryRouter initialEntries={[ROUTES.dashboard]}>
          <AppShell user={{ fullName: 'Demo User', role }} breadcrumb={[{ label: 'Dashboard' }]}>
            <p>content</p>
          </AppShell>
        </MemoryRouter>,
      );
      const nav = screen.getByRole('navigation', { name: 'Main' });
      for (const label of labels) {
        expect(within(nav).queryByRole('link', { name: label })).not.toBeInTheDocument();
      }
    },
  );

  it('keeps a heading only while it still has visible items', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.dashboard]}>
        <AppShell user={{ fullName: 'Bui Van Hai', role: 'GROOM' }} breadcrumb={[{ label: 'Today' }]}>
          <p>content</p>
        </AppShell>
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Today', 'Incidents']);
    expect(within(nav).getByText('My Work')).toBeInTheDocument();
    expect(visibleSections('CLUB_MANAGER')[2].items.map((item) => item.label)).toEqual(['Audit Log']);
  });

  it('drops a section whose items are all deferred', () => {
    const sections = withoutDeferred([
      { items: [{ label: 'Dashboard', icon: 'dashboard', to: ROUTES.dashboard }] },
      { heading: 'Later', items: [{ label: 'Races', icon: 'target', to: ROUTES.races, deferred: 'later' }] },
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBeUndefined();
  });
});

describe('role navigation', () => {
  it('defines a sidebar for exactly the 7 RBAC roles', () => {
    expect(Object.keys(NAVIGATION).sort()).toEqual([...ROLE_CODES].sort());
    expect(ROLE_CODES).toHaveLength(7);
    expect(ROLE_CODES).not.toContain('SYSTEM');
  });

  it('only uses Design System icons and central route paths', () => {
    const paths = new Set<string>(Object.values(ROUTES));
    for (const role of ROLE_CODES) {
      for (const item of NAVIGATION[role].sections.flatMap((section) => section.items)) {
        expect(ICON_NAMES).toContain(item.icon);
        expect(paths.has(item.to)).toBe(true);
      }
    }
  });

  it('gives the Horse Owner the read-only portal entries only', () => {
    const labels = NAVIGATION.HORSE_OWNER.sections.flatMap((section) => section.items.map((item) => item.label));
    expect(labels).toEqual(['My Horses', 'Notifications']);
  });
});

describe('AppShell', () => {
  it.each(ROLE_CODES)('renders the %s workspace with its own modules only', (role) => {
    render(
      <MemoryRouter initialEntries={[ROUTES.dashboard]}>
        <AppShell user={{ fullName: 'Le Quoc Bao', role }} breadcrumb={[{ label: 'Dashboard' }]}>
          <p>content</p>
        </AppShell>
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const expected = visibleSections(role).flatMap((section) => section.items.map((item) => item.label));
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(expected);
    expect(screen.getByText(NAVIGATION[role].workspaceLabel)).toBeInTheDocument();
    expect(screen.getByText(ROLE_LABELS[role])).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('content');
  });

  it('marks the current route as active and shows the unread count', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.staffUsers]}>
        <AppShell
          user={{ fullName: 'Nguyen Thanh', role: 'CLUB_MANAGER' }}
          breadcrumb={[{ label: 'Administration' }, { label: 'Staff & Users' }]}
          unreadCount={3}
        >
          <p>content</p>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Staff & Users' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
    expect(screen.getByText('NT')).toBeInTheDocument();
  });
});
