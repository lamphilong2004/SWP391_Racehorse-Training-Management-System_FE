import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextAreaField } from './TextAreaField';

describe('TextAreaField', () => {
  it('renders a multiline field with required label and helper text', () => {
    render(<TextAreaField label="Ghi chú chuyên môn" required helperText="Add the session context." />);

    const textarea = screen.getByRole('textbox', { name: 'Ghi chú chuyên môn' });
    expect(textarea).toBeRequired();
    expect(textarea).toHaveAttribute('rows', '3');
    expect(textarea).toHaveAccessibleDescription('Add the session context.');
  });

  it('accepts text and exposes a validation error accessibly', async () => {
    const user = userEvent.setup();
    render(<TextAreaField label="Ghi chú chuyên môn" error="Enter a note." />);

    const textarea = screen.getByRole('textbox', { name: 'Ghi chú chuyên môn' });
    await user.type(textarea, 'Stopped after rep three.');

    expect(textarea).toHaveValue('Stopped after rep three.');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription('Enter a note.');
  });

  it('respects the disabled state', () => {
    render(<TextAreaField label="Ghi chú chuyên môn" disabled />);

    expect(screen.getByRole('textbox', { name: 'Ghi chú chuyên môn' })).toBeDisabled();
  });
});
