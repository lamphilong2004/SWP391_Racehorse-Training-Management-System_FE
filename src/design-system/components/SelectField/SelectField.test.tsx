import { render, screen } from '@testing-library/react';
import { SelectField } from './SelectField';

it('marks required dropdowns visually and natively without changing their accessible label', () => {
  render(<SelectField label="Groom phụ trách" required placeholder="Chọn Groom" options={[{ value: '8', label: 'Groom đã được cấp quyền' }]} />);
  const control = screen.getByRole('combobox', { name: 'Groom phụ trách' });
  expect(control).toBeRequired();expect(screen.getByLabelText('Groom phụ trách')).toBe(control);
  expect(document.querySelector(`label[for="${control.id}"]`)).toHaveTextContent('Groom phụ trách *');
});
it('preserves explicit aria labels, disabled/error state and description', () => {
  render(<SelectField label="Ngựa" aria-label="Ngựa được phép chọn" disabled error="Không tải được danh sách." options={[]} />);
  const control = screen.getByRole('combobox', { name: 'Ngựa được phép chọn' });
  expect(control).toBeDisabled();expect(control).toHaveAttribute('aria-invalid', 'true');expect(control).toHaveAccessibleDescription('Không tải được danh sách.');
});
