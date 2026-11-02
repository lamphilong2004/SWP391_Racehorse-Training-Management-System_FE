import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresetField } from './PresetField';

const options = [{ value: 'kg', label: 'kg — kilôgam' }, { value: 'g', label: 'g — gam' }];
function Field({ initial = '', disabled = false, error }: { initial?: string; disabled?: boolean; error?: string }) {
  const [value, setValue] = useState(initial);
  return <><PresetField label="Đơn vị" value={value} onValueChange={setValue} options={options} required maxLength={20} disabled={disabled} error={error} /><output aria-label="Giá trị gửi API">{value}</output></>;
}
it('starts empty and sends the preset value rather than its display label', async () => {
  render(<Field />);
  expect(screen.getByRole('combobox', { name: 'Đơn vị' })).toHaveValue('');
  expect(screen.getByRole('combobox', { name: 'Đơn vị' })).toBeRequired();
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Đơn vị' }), 'kg');
  expect(screen.getByLabelText('Giá trị gửi API')).toHaveTextContent(/^kg$/);
});
it('preserves unknown saved text and permits returning to a preset', async () => {
  render(<Field initial="bao 25 kg" />);
  expect(screen.getByRole('textbox', { name: 'Đơn vị (nhập thêm)' })).toHaveValue('bao 25 kg');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Đơn vị' }), 'g');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Giá trị gửi API')).toHaveTextContent(/^g$/);
});
it('does not erase the current value when opening custom entry and associates validation with that input', async () => {
  render(<Field initial="kg" error="Kiểm tra đơn vị" />);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Đơn vị' }), '__CUSTOM_VALUE__');
  const custom = screen.getByRole('textbox', { name: 'Đơn vị (nhập thêm)' });
  expect(custom).toHaveValue('kg');expect(custom).toBeRequired();expect(custom).toHaveAttribute('maxlength', '20');
  expect(custom).toHaveAccessibleDescription('Kiểm tra đơn vị');
  fireEvent.change(custom, { target: { value: 'bao' } });
  expect(screen.getByLabelText('Giá trị gửi API')).toHaveTextContent(/^bao$/);
});
it('disables both controls while a save is pending', () => {
  render(<Field initial="chai" disabled />);
  expect(screen.getByRole('combobox')).toBeDisabled();expect(screen.getByRole('textbox')).toBeDisabled();
});
