import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ROUTES } from '../app/routePaths';
import { ICON_NAMES } from '../design-system/icons/iconNames';
import { ROLE_CODES, ROLE_LABELS } from '../shared/auth/roles';
import { AppShell } from './AppShell';
import { NAVIGATION } from './navigation';

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
    const expected = NAVIGATION[role].sections.flatMap((section) => section.items.map((item) => item.label));
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
