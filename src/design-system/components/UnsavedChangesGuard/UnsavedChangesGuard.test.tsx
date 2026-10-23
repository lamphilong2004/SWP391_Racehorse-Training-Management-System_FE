import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';

function mount(dirty = true) {
  function Form() {
    const [changed, setChanged] = useState(dirty);
    return <><UnsavedChangesGuard dirty={changed} /><input aria-label="Draft input" defaultValue="Retained" />
      <Link to="/other">Leave form</Link><Link to="/login">Đăng xuất</Link><button onClick={() => setChanged(false)}>Mark clean</button></>;
  }
  const router = createMemoryRouter([{ path: '/edit', Component: Form }, { path: '/other', element: <h1>Destination</h1> }, { path: '/login', element: <h1>Sign in</h1> }], { initialEntries: ['/other', '/edit'], initialIndex: 1 });
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}
it('retains current view and input when a dirty route leave is cancelled', async () => {
  mount(); await userEvent.click(screen.getByRole('link', { name: 'Leave form' }));
  expect(await screen.findByRole('dialog', { name: 'Thay đổi chưa lưu' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
  expect(screen.getByRole('textbox')).toHaveValue('Retained'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('requires explicit discard to finish a blocked browser Back navigation', async () => {
  const { router } = mount(); await act(() => router.navigate(-1));
  await userEvent.click(await screen.findByRole('button', { name: 'Hủy thay đổi' }));
  expect(await screen.findByRole('heading', { name: 'Destination' })).toBeInTheDocument();
});
it('cancels a pending leave on Escape without discarding the form', async () => {
  const { router } = mount(); await userEvent.click(screen.getByRole('link', { name: 'Leave form' }));
  fireEvent(await screen.findByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(router.state.location.pathname).toBe('/edit'); expect(screen.getByRole('textbox')).toHaveValue('Retained');
});
it('does not block clean forms or an auth redirect to login', async () => {
  const clean = mount(false); await userEvent.click(screen.getByRole('link', { name: 'Leave form' }));
  expect(await screen.findByRole('heading', { name: 'Destination' })).toBeInTheDocument(); clean.unmount();
  mount(); await userEvent.click(screen.getByRole('link', { name: 'Đăng xuất' }));
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('warns before reload only while dirty and removes the listener on unmount', async () => {
  const { unmount } = mount();
  const dirty = new Event('beforeunload', { cancelable: true }); fireEvent(window, dirty); expect(dirty.defaultPrevented).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Mark clean' }));
  const clean = new Event('beforeunload', { cancelable: true }); fireEvent(window, clean); expect(clean.defaultPrevented).toBe(false);
  unmount(); const disposed = new Event('beforeunload', { cancelable: true }); fireEvent(window, disposed); expect(disposed.defaultPrevented).toBe(false);
});
it('does not write draft data to any browser storage', async () => {
  const write = vi.spyOn(Storage.prototype, 'setItem'); mount();
  await userEvent.click(screen.getByRole('link', { name: 'Leave form' })); await userEvent.click(await screen.findByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
  expect(write).not.toHaveBeenCalled(); write.mockRestore();
});
it('can allow query-only view changes on the same route while still guarding a route leave', async () => {
  function Form() {
    return <><UnsavedChangesGuard dirty allowSameRoute /><input aria-label="Draft input" defaultValue="Retained" />
      <Link to="/edit?view=history">History view</Link><Link to="/other">Leave form</Link></>;
  }
  const router = createMemoryRouter([{ path: '/edit', Component: Form }, { path: '/other', element: <h1>Destination</h1> }], { initialEntries: ['/edit'] });
  render(<RouterProvider router={router} />);
  await userEvent.click(screen.getByRole('link', { name: 'History view' }));
  expect(router.state.location.search).toBe('?view=history'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: 'Leave form' }));
  expect(await screen.findByRole('dialog', { name: 'Thay đổi chưa lưu' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/edit');
});
