import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, DesignSystemScope, Drawer, Modal, ResponsiveGrid, Skeleton, Stack, ToastRegion } from '../../index';

it('keeps a controlled pending button disabled, named and unable to submit twice', async () => {
  const click = vi.fn();
  const { rerender } = render(<Button loading onClick={click}>Save</Button>);
  const button = screen.getByRole('button', { name: 'Save' });
  expect(button).toBeDisabled(); expect(button).toHaveAttribute('aria-busy', 'true');
  await userEvent.click(button); await userEvent.click(button); expect(click).not.toHaveBeenCalled();
  rerender(<Button onClick={click}>Save</Button>); await userEvent.click(screen.getByRole('button', { name: 'Save' })); expect(click).toHaveBeenCalledOnce();
});
it('preserves legacy busy attributes and supports a named icon action and danger alias', () => {
  render(<><Button aria-busy>Existing</Button><Button variant="icon" aria-label="Close panel">×</Button><Button variant="danger">Discard</Button></>);
  expect(screen.getByRole('button', { name: 'Existing' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('button', { name: 'Close panel' })).toBeEnabled(); expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled();
});
it('adds a shared scope without changing the document theme or child semantics', () => {
  render(<DesignSystemScope><ResponsiveGrid><Stack><h2>Region</h2></Stack></ResponsiveGrid></DesignSystemScope>);
  expect(screen.getByRole('heading', { name: 'Region' }).closest('[data-design-system]')).toHaveAttribute('data-design-system', 'v2');
  expect(document.documentElement).not.toHaveAttribute('data-design-system');
});
it('bounds skeleton shape dimensions and exposes one labelled busy region', () => {
  const { rerender } = render(<Skeleton label="Loading cards" lines={1000} />);
  expect(screen.getByRole('status', { name: 'Loading cards' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('status').children).toHaveLength(12);
  rerender(<Skeleton lines={NaN} shape="card" />); expect(screen.getByRole('status').children).toHaveLength(1);
});
it('deduplicates feedback IDs, renders text safely and only dismisses through the owner', async () => {
  const dismiss = vi.fn();
  render(<ToastRegion items={[{ id: 'a', message: '<b>Text</b>' }, { id: 'a', message: 'Duplicate' }, { id: 'b', message: 'Request failed', tone: 'error' }]} onDismiss={dismiss} />);
  expect(screen.getAllByRole('status')).toHaveLength(1); expect(screen.getByRole('alert')).toHaveTextContent('Request failed');
  expect(screen.queryByText('Duplicate')).not.toBeInTheDocument(); expect(screen.getByText('<b>Text</b>').querySelector('b')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss <b>Text</b>' })); expect(dismiss).toHaveBeenCalledWith('a');
});
it.each([Modal, Drawer])('keeps an opted-in dirty overlay open on Escape and close button', async Component => {
  const close = vi.fn();
  const { rerender } = render(<Component open onClose={close} title="Editing" dismissible={false}><input aria-label="Draft" defaultValue="Retained" /></Component>);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(close).not.toHaveBeenCalled(); expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('Retained');
  rerender(<Component open onClose={close} title="Editing"><input aria-label="Draft" defaultValue="Retained" /></Component>);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true })); expect(close).toHaveBeenCalledOnce();
});
