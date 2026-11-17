import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TailwindPatternExample } from './TailwindPatternExample';

it('filters the shared table and validates, cancels and submits the example modal', async () => {
  const user = userEvent.setup();
  render(<TailwindPatternExample />);

  await user.type(screen.getByRole('searchbox', { name: 'Tìm chương trình mẫu' }), 'không tồn tại');
  expect(screen.getByText('Không tìm thấy chương trình mẫu')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  expect(screen.getByRole('cell', { name: 'Rèn sức bền' })).toBeInTheDocument();

  const open = screen.getByRole('button', { name: 'Thêm chương trình mẫu' });
  await user.click(open);
  const dialog = within(screen.getByRole('dialog', { name: 'Thêm chương trình mẫu' }));
  await user.click(dialog.getByRole('button', { name: 'Lưu vào bảng mẫu' }));
  expect(dialog.getByLabelText('Tên chương trình')).toHaveAccessibleDescription('Nhập tên chương trình.');
  expect(dialog.getByLabelText('Tên chương trình')).toHaveFocus();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(open).toHaveFocus();

  await user.click(open);
  await user.type(dialog.getByLabelText('Tên chương trình'), '  Khởi động  ');
  await user.selectOptions(dialog.getByLabelText('Trạng thái chương trình'), 'PAUSED');
  await user.click(dialog.getByRole('button', { name: 'Lưu vào bảng mẫu' }));
  const row = screen.getByRole('row', { name: /Khởi động/ });
  expect(within(row).getByText('Tạm dừng')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('3 kết quả');
});
