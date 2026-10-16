import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextAreaField } from './TextAreaField';

describe('TextAreaField', () => {
  it('renders a multiline field with required label and helper text', () => {
    render(<TextAreaField label="Professional notes" required helperText="Add the session context." />);

    const textarea = screen.getByRole('textbox', { name: 'Professional notes' });
    expect(textarea).toBeRequired();
    expect(textarea).toHaveAttribute('rows', '3');
    expect(textarea).toHaveAccessibleDescription('Add the session context.');
  });

  it('accepts text and exposes a validation error accessibly', async () => {
    const user = userEvent.setup();
    render(<TextAreaField label="Professional notes" error="Enter a note." />);

    const textarea = screen.getByRole('textbox', { name: 'Professional notes' });
    await user.type(textarea, 'Stopped after rep three.');

    expect(textarea).toHaveValue('Stopped after rep three.');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription('Enter a note.');
  });

  it('respects the disabled state', () => {
    render(<TextAreaField label="Professional notes" disabled />);

    expect(screen.getByRole('textbox', { name: 'Professional notes' })).toBeDisabled();
  });
});
