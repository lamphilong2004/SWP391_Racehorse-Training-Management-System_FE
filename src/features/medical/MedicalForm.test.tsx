import { fireEvent, render, screen } from '@testing-library/react';
import { MedicalForm } from './MedicalForm';

it('does not submit invalid IDs and lets the user cancel without saving', async () => {
  const save = vi.fn(), cancel = vi.fn();
  render(<MedicalForm fields={[{ name: 'horseId', label: 'Mã ngựa', type: 'number', required: true }]} submitLabel="Tạo ca" onSave={save} onCancel={cancel} />);
  fireEvent.change(screen.getByLabelText('Mã ngựa'), { target: { value: '-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tạo ca' }));
  expect(await screen.findByText('Nhập mã số dương')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(save).not.toHaveBeenCalled();
});

it('rejects overlong contract fields without discarding the input', async () => {
  const save = vi.fn();
  render(<MedicalForm fields={[{ name: 'reason', label: 'Lý do', type: 'textarea', required: true, maxLength: 2000 }]} submitLabel="Tạo ca" onSave={save} />);
  const value = 'x'.repeat(2001);
  fireEvent.change(screen.getByLabelText('Lý do'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Tạo ca' }));
  expect(await screen.findByText('Lý do tối đa 2000 ký tự')).toBeInTheDocument();
  expect(screen.getByLabelText('Lý do')).toHaveValue(value);
  expect(save).not.toHaveBeenCalled();
});
