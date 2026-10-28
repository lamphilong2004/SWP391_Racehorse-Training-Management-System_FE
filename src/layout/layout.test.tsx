import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { ROUTES } from '../app/routePaths';
import { ICON_NAMES } from '../design-system/icons/iconNames';
import { ROLE_CODES, ROLE_LABELS } from '../shared/auth/roles';
import { AppShell } from './AppShell';
import { NAVIGATION, visibleSections, withoutDeferred } from './navigation';
import type { RoleCode } from '../shared/auth/roles';

/** Deferred modules per the CORE-002 DoD (DEC-007, DEC-008 §3.5). */
const DEFERRED_BY_ROLE: Partial<Record<RoleCode, string[]>> = {
  CLUB_MANAGER: ['Chuồng', 'Cuộc đua', 'Kho', 'Báo cáo'],
  HEAD_TRAINER: ['Cuộc đua'],
  VETERINARIAN: ['Chăm sóc phòng ngừa'],
  GROOM: ['Chăm sóc hằng ngày', 'Chăm sóc phòng ngừa'],
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
          <AppShell user={{ fullName: 'Demo User', role }} breadcrumb={[{ label: 'Tổng quan' }]}>
            <p>content</p>
          </AppShell>
        </MemoryRouter>,
      );
      const nav = screen.getByRole('navigation', { name: 'Chính' });
      for (const label of labels) {
        expect(within(nav).queryByRole('link', { name: label })).not.toBeInTheDocument();
      }
    },
  );

  it('keeps a heading only while it still has visible items', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.dashboard]}>
        <AppShell user={{ fullName: 'Bui Van Hai', role: 'GROOM' }} breadcrumb={[{ label: 'Hôm nay' }]}>
          <p>content</p>
        </AppShell>
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Chính' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Hôm nay', 'Công việc chăm sóc', 'Sự cố']);
    expect(within(nav).getByText('Công việc của tôi')).toBeInTheDocument();
    expect(visibleSections('CLUB_MANAGER')[2].items.map((item) => item.label)).toEqual(['Nhật ký hệ thống']);
  });

  it('drops a section whose items are all deferred', () => {
    const sections = withoutDeferred([
      { items: [{ label: 'Tổng quan', icon: 'dashboard', to: ROUTES.dashboard }] },
      { heading: 'Later', items: [{ label: 'Cuộc đua', icon: 'target', to: ROUTES.races, deferred: 'later' }] },
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
    expect(labels).toEqual(['Ngựa của tôi', 'Thông báo']);
  });
});

describe('AppShell', () => {
  it.each(ROLE_CODES)('renders the %s workspace with its own modules only', (role) => {
    render(
      <MemoryRouter initialEntries={[ROUTES.dashboard]}>
        <AppShell user={{ fullName: 'Le Quoc Bao', role }} breadcrumb={[{ label: 'Tổng quan' }]}>
          <p>content</p>
        </AppShell>
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Chính' });
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
          breadcrumb={[{ label: 'Quản trị' }, { label: 'Nhân sự & người dùng' }]}
          unreadCount={3}
        >
          <p>content</p>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Nhân sự & người dùng' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Thông báo, 3 chưa đọc' })).toBeInTheDocument();
    expect(screen.getByText('NT')).toBeInTheDocument();
  });

  it('opens the account menu with identity and shortcuts, closes on Escape and navigates from an item', async () => {
    const router = createMemoryRouter([
      { path: '*', element: <AppShell user={{ fullName: 'Nguyen Thanh', role: 'VETERINARIAN' }} breadcrumb={[{ label: 'Tổng quan' }]} unreadCount={2}><p>content</p></AppShell> },
    ], { initialEntries: [ROUTES.dashboard] });
    render(<RouterProvider router={router} />);
    const actor = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Menu tài khoản' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await actor.click(trigger);
    const menu = screen.getByRole('menu', { name: 'Tài khoản' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Tài khoản của tôiHồ sơ cá nhân và thông tin đăng nhập',
      'Đổi mật khẩuNên đổi mật khẩu do Club Manager cấp',
      'Thông báo2 thông báo chưa đọc2',
      'Không gian làm việcVề trang tổng quan của vai trò',
    ]);
    expect(within(menu).getAllByRole('menuitem')[0]).toHaveFocus();
    await actor.keyboard('{ArrowDown}');
    expect(within(menu).getAllByRole('menuitem')[1]).toHaveFocus();

    await actor.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await actor.click(trigger);
    await actor.click(screen.getByRole('menuitem', { name: /Đổi mật khẩu/ }));
    expect(router.state.location.pathname).toBe(ROUTES.account);
    expect(router.state.location.hash).toBe('#doi-mat-khau');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it.each([
    ['CLUB_MANAGER', '/horses/6', 'Ngựa'],
    ['CLUB_MANAGER', '/horses/6/identity', 'Ngựa'],
    ['CLUB_MANAGER', ROUTES.pendingActivation, 'Chờ kích hoạt'],
    ['HORSE_OWNER', `${ROUTES.myHorses}/9`, 'Ngựa của tôi'],
    ['WORK_RIDER', ROUTES.assignments, 'Lịch phân công'],
  ] as Array<[RoleCode, string, string]>)('keeps exactly one entry current for %s at %s', (role, path, label) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppShell user={{ fullName: 'Le Quoc Bao', role }} breadcrumb={[{ label }]}><p>content</p></AppShell>
      </MemoryRouter>,
    );
    const current = within(screen.getByRole('navigation', { name: 'Chính' })).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual([label]);
  });
});

describe('responsive navigation drawer (Design System v2 §E)', () => {
  function mountShell() {
    const router = createMemoryRouter([
      { path: '/rider', element: <AppShell user={{ fullName: 'Demo Rider', role: 'WORK_RIDER' }} breadcrumb={[{ label: 'Lượt cưỡi của tôi' }]}><p>Rides</p></AppShell> },
      { path: '/rider/assignments', element: <AppShell user={{ fullName: 'Demo Rider', role: 'WORK_RIDER' }} breadcrumb={[{ label: 'Lịch phân công' }]}><p>Assignments page</p></AppShell> },
    ], { initialEntries: ['/rider'] });
    render(<RouterProvider router={router} />);
    return router;
  }

  it('applies the v2 scope to the shell chrome and offers a skip link', () => {
    mountShell();
    expect(screen.getByRole('complementary', { name: 'Điều hướng không gian làm việc' })).toHaveAttribute('data-design-system', 'v2');
    expect(screen.getByRole('banner')).toHaveAttribute('data-design-system', 'v2');
    expect(screen.getByRole('link', { name: 'Bỏ qua đến nội dung chính' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).not.toHaveAttribute('data-design-system');
  });

  it('opens from the header, closes on Escape and returns focus to the menu button', async () => {
    mountShell();
    const menu = screen.getByRole('button', { name: 'Mở menu' });
    expect(menu).toHaveAttribute('aria-controls', 'app-navigation');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(menu);
    expect(screen.getByRole('button', { name: 'Đóng menu', expanded: true })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Mở menu' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Mở menu' })).toHaveFocus();
  });

  it('closes after following a navigation link', async () => {
    const router = mountShell();
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu' }));
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Chính' })).getByRole('link', { name: 'Lịch phân công' }));
    expect(await screen.findByText('Assignments page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/rider/assignments');
    expect(screen.getByRole('button', { name: 'Mở menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('scopes reviewed page content to v2 only when the screen opts in', () => {
    render(<MemoryRouter><AppShell designSystem="v2" user={{ fullName: 'Demo Rider', role: 'WORK_RIDER' }} breadcrumb={[{ label: 'Lượt cưỡi của tôi' }]}><p>Rides</p></AppShell></MemoryRouter>);
    expect(screen.getByRole('main')).toHaveAttribute('data-design-system', 'v2');
  });
});
