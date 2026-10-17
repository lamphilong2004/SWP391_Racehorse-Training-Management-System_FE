import { fireEvent, render, screen } from '@testing-library/react';
import { MedicalForm } from './MedicalForm';

it('does not submit invalid IDs and lets the user cancel without saving', async () => {
  const save = vi.fn(), cancel = vi.fn();
  render(<MedicalForm fields={[{ name: 'horseId', label: 'Horse ID', type: 'number', required: true }]} submitLabel="Create case" onSave={save} onCancel={cancel} />);
  fireEvent.change(screen.getByLabelText('Horse ID'), { target: { value: '-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create case' }));
  expect(await screen.findByText('Enter a positive numeric ID')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(save).not.toHaveBeenCalled();
});

it('rejects overlong contract fields without discarding the input', async () => {
  const save = vi.fn();
  render(<MedicalForm fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, maxLength: 2000 }]} submitLabel="Create case" onSave={save} />);
  const value = 'x'.repeat(2001);
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Create case' }));
  expect(await screen.findByText('Reason must be 2000 characters or fewer')).toBeInTheDocument();
  expect(screen.getByLabelText('Reason')).toHaveValue(value);
  expect(save).not.toHaveBeenCalled();
});
