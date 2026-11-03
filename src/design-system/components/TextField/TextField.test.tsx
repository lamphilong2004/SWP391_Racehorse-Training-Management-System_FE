import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from './TextField';

describe('TextField visual and accessible required state', () => {
  it('marks a required field visually without adding the star to its accessible name', () => {
    render(<TextField label="Tên ngựa" required helperText="Nhập tên theo hồ sơ." />);
    const input = screen.getByRole('textbox', { name: 'Tên ngựa' });expect(input).toBeRequired();
    expect(document.querySelector(`label[for="${input.id}"]`)).toHaveTextContent('Tên ngựa *');
    expect(input).toHaveAccessibleDescription('Nhập tên theo hồ sơ.');expect(screen.getByLabelText('Tên ngựa')).toBe(input);
  });
  it('retains explicit accessible labels, errors and disabled state', () => {
    render(<TextField label="Tên" aria-label="Tên người phụ trách" disabled error="Không có quyền sửa." />);
    const input = screen.getByRole('textbox', { name: 'Tên người phụ trách' });expect(input).toBeDisabled();expect(input).toHaveAttribute('aria-invalid', 'true');expect(input).toHaveAccessibleDescription('Không có quyền sửa.');
  });
});
