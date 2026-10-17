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
