import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { IncidentReportModal, type IncidentSource } from './IncidentReportModal';

const groom: IncidentSource = { kind: 'groom', horseId: 31, horseLabel: 'Silver Comet', preSessionCheckId: 12, observedAt: '2020-02-29T08:30:00.000Z', contextLabel: 'From pre-session check' };

function mount(source: IncidentSource = groom, onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  const view = render(<IncidentReportModal open onClose={onClose} onSubmit={onSubmit} source={source} />);
  return { onSubmit, onClose, ...view };
}

async function fill(description = 'Swelling on left hind fetlock.') {
  await userEvent.click(screen.getByRole('button', { name: 'Vấn đề móng hoặc chân' }));
  await userEvent.click(screen.getByRole('button', { name: 'Medium' }));
  fireEvent.change(screen.getByLabelText('Mô tả *'), { target: { value: description } });
}

function submit() { fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement); }

describe('IncidentReportModal', () => {
  it('requires horse, type, severity and description', async () => {
    const { onSubmit } = mount({ kind: 'groom' });
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Hãy điền đủ các trường bắt buộc');
    await userEvent.selectOptions(screen.getByLabelText('Ngựa *'), 'manual');
    fireEvent.change(screen.getByLabelText('Mã ngựa *'), { target: { value: '31' } });
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ ăn' }));
    fireEvent.change(screen.getByLabelText('Mô tả *'), { target: { value: 'Not eating' } });
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Low' }));
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  });

  it('rejects blank description after all other required fields are selected', async () => {
    const { onSubmit } = mount();
    await fill('   ');
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Hãy điền đủ các trường bắt buộc');
  });

  it('keeps the horse fixed for a pre-session check and supports keyboard navigation and selection', async () => {
    mount();
    const horse = screen.getByLabelText('Ngựa *');
    expect(horse).toBeDisabled();
    expect(horse).toHaveValue('31');
    const firstType = screen.getByRole('button', { name: 'Bỏ ăn' });
    const secondType = screen.getByRole('button', { name: 'Dấu hiệu đau bụng' });
    firstType.focus();
    await userEvent.tab();
    expect(secondType).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(firstType).toHaveFocus();
    const type = screen.getByRole('button', { name: 'Vấn đề móng hoặc chân' });
    type.focus();
    expect(type).toHaveFocus();
    await userEvent.keyboard('[Space]');
    expect(type).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects horse ID %s', async (horseId) => {
    const { onSubmit } = mount({ ...groom, horseId });
    await fill(); submit();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '12'])('rejects context ID %s', async (preSessionCheckId) => {
    const { onSubmit } = mount({ ...groom, preSessionCheckId } as IncidentSource);
    await fill(); submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Mã nguồn phải là số nguyên dương.');
  });

  it('rejects multiple source contexts', async () => {
    const { onSubmit } = mount({ ...groom, careTaskId: 9 });
    await fill(); submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Hãy chọn một nguồn phát sinh sự cố.');
  });

  it('rejects missing, malformed and future observedAt', async () => {
    const { onSubmit, rerender, onClose } = mount({ ...groom, observedAt: 'invalid' });
    await fill(); submit();
    expect(screen.getByRole('alert')).toHaveTextContent('Thời điểm phát hiện phải hợp lệ');
    rerender(<IncidentReportModal open onClose={onClose} onSubmit={onSubmit} source={{ ...groom, observedAt: '2020-02-30T08:30:00Z' }} />);
    await fill(); submit();
    expect(onSubmit).not.toHaveBeenCalled();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    rerender(<IncidentReportModal open onClose={onClose} onSubmit={onSubmit} source={{ ...groom, observedAt: future.toISOString() }} />);
    await fill(); submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Thời điểm phát hiện phải hợp lệ');
    fireEvent.change(screen.getByLabelText('Thời điểm phát hiện *'), { target: { value: '2020-02-30T08:30' } });
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('serializes observedAt to UTC ISO and sends exact OpenAPI keys', async () => {
    const { onSubmit, onClose } = mount();
    await fill();
    fireEvent.change(screen.getByLabelText('Thời điểm phát hiện *'), { target: { value: '2020-02-29T08:30' } });
    await userEvent.click(screen.getByRole('button', { name: 'Gửi sự cố' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toEqual({ horseId: 31, incidentType: 'HOOF_OR_LEG_PROBLEM', observedSeverity: 'MEDIUM', observedAt: new Date(2020, 1, 29, 8, 30).toISOString(), description: 'Swelling on left hind fetlock.', preSessionCheckId: 12 });
    expect(onSubmit.mock.calls[0][0].observedAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(onSubmit.mock.calls[0]).toHaveLength(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('rejects descriptions longer than 2,000 characters', async () => {
    const { onSubmit } = mount();
    await fill('a'.repeat(2001)); submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('tối đa 2.000 ký tự');
  });

  it('locks duplicate submit and close while pending, then closes on success', async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn().mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    const { onClose } = mount(groom, onSubmit);
    await fill(); submit(); submit();
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog').querySelector('form')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đang gửi…' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    resolve();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('shows error, permits retry, and resets fields and error on reopen', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('Conflict')).mockResolvedValue(undefined);
    const { onClose, rerender } = mount(groom, onSubmit);
    await fill(); submit();
    expect(await screen.findByText('Conflict')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi sự cố' })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).toHaveBeenCalledOnce();
    rerender(<IncidentReportModal open={false} onClose={onClose} onSubmit={onSubmit} source={groom} />);
    rerender(<IncidentReportModal open onClose={onClose} onSubmit={onSubmit} source={groom} />);
    expect(screen.getByLabelText('Mô tả *')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Conflict')).not.toBeInTheDocument();
    await fill(); submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });

  it('has labeled dialog and fields, and closes with Escape when idle', () => {
    const { onClose } = mount();
    const dialog = screen.getByRole('dialog', { name: 'Báo cáo sự cố' });
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(screen.getByLabelText('Ngựa *')).toBeDisabled();
    expect(screen.getByLabelText('Thời điểm phát hiện *')).toBeRequired();
    expect(screen.getByLabelText('Mô tả *')).toBeRequired();
    expect(dialog.querySelector('[data-icon="clipboard-list"]')?.tagName).toBe('SPAN');
    expect(dialog.querySelector('[data-icon="info"]')?.tagName).toBe('SPAN');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('assigns distinct form and description IDs, linking each footer button and label to its form', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<>
      <IncidentReportModal open onClose={vi.fn()} onSubmit={onSubmit} source={groom} />
      <IncidentReportModal open onClose={vi.fn()} onSubmit={onSubmit} source={{ kind: 'groom', horseId: 1, horseLabel: 'Thunder Bolt', careTaskId: 412, contextLabel: 'From care task' }} />
    </>);
    const dialogs = screen.getAllByRole('dialog');
    const formIds = dialogs.map((dialog) => {
      const form = dialog.querySelector('form');
      const button = dialog.querySelector('button[type="submit"]');
      const description = dialog.querySelector('textarea');
      const label = dialog.querySelector('label[for$="-description"]');
      expect(form?.id).toBeTruthy();
      expect(button).toHaveAttribute('form', form?.id);
      expect(description?.id).toBe(`${form?.id}-description`);
      expect(label).toHaveAttribute('for', description?.id);
      return form?.id;
    });
    expect(new Set(formIds).size).toBe(2);
    expect(new Set(dialogs.map((dialog) => dialog.querySelector('textarea')?.id)).size).toBe(2);
  });

});
