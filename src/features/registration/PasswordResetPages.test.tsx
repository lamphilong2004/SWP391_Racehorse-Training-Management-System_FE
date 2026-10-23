import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ForgotPasswordPage, ResetPasswordPage } from './PasswordResetPages';

// HTTP fixtures for the DEC-008 R9 contract; not Backend evidence.
const accepted = () => new Response(JSON.stringify({ success: true, data: { message: 'Nếu email này có tài khoản, liên kết đặt lại mật khẩu đã được gửi.' } }), { status: 202 });
const failure = (status: number) => new Response(JSON.stringify({ success: false, error: { code: 'INVALID_TOKEN', message: 'SERVER-DETAIL', details: [] } }), { status });
function mount(path: string) {
  const router = createMemoryRouter([
    { path: '/forgot-password', element: <ForgotPasswordPage /> },
    { path: '/reset-password', element: <ResetPasswordPage /> },
    { path: '/login', element: <h1>Sign in</h1> },
  ], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
afterEach(() => vi.unstubAllGlobals());

it('sends only the email and always shows the neutral confirmation', async () => {
  const fetcher = vi.fn().mockResolvedValue(accepted()); vi.stubGlobal('fetch', fetcher);
  mount('/forgot-password');
  fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }));
  expect(await screen.findByText('Nhập email hợp lệ, tối đa 254 ký tự.')).toBeInTheDocument(); expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: ' groom@example.test ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }));
  expect(await screen.findByText('Nếu email này có tài khoản, liên kết đặt lại mật khẩu đã được gửi.')).toBeInTheDocument();
  const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
  expect(url).toMatch(/\/api\/auth\/forgot-password$/); expect(JSON.parse(String(init.body))).toEqual({ email: 'groom@example.test' });
});

it('removes the token from the address bar, validates locally and posts the reset once', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetcher);
  const router = mount('/reset-password?token=signed-token');
  expect(router.state.location.search).toBe('');
  fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/), { target: { value: 'short' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đặt mật khẩu mới' }));
  expect(await screen.findByText(/Dùng 8–64 ký tự/)).toBeInTheDocument(); expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/), { target: { value: 'Stable2026' } });
  fireEvent.change(screen.getByLabelText(/^Nhập lại mật khẩu mới/), { target: { value: 'Stable2026' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đặt mật khẩu mới' }));
  expect(await screen.findByText('Đã cập nhật mật khẩu')).toBeInTheDocument();
  expect(JSON.parse(String((fetcher.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ token: 'signed-token', newPassword: 'Stable2026', confirmPassword: 'Stable2026' });
});

it('explains an invalid or expired link without echoing server details', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failure(400)));
  mount('/reset-password?token=used-token');
  fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/), { target: { value: 'Stable2026' } });
  fireEvent.change(screen.getByLabelText(/^Nhập lại mật khẩu mới/), { target: { value: 'Stable2026' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đặt mật khẩu mới' }));
  expect(await screen.findByText(/Liên kết đặt lại không hợp lệ, đã dùng hoặc đã hết hạn\. Hãy yêu cầu liên kết mới\./)).toBeInTheDocument();
  expect(screen.queryByText('SERVER-DETAIL')).not.toBeInTheDocument();
});

it('asks for a new link when the token is missing', () => {
  mount('/reset-password');
  expect(screen.getByText('Thiếu liên kết đặt lại')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Yêu cầu liên kết mới' })).toHaveAttribute('href', '/forgot-password');
});
