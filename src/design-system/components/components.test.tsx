import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { AlertBanner } from './AlertBanner/AlertBanner';
import { Breadcrumb } from './Breadcrumb/Breadcrumb';
import { Button } from './Button/Button';
import { DataTable } from './DataTable/DataTable';
import { EmptyState } from './EmptyState/EmptyState';
import { MetricCard } from './MetricCard/MetricCard';
import { Modal } from './Overlay/Modal';
import { SelectField } from './SelectField/SelectField';
import { Tabs } from './Tabs/Tabs';
import { TextField } from './TextField/TextField';
import { WizardStepper } from './WizardStepper/WizardStepper';

describe('Button', () => {
  it('renders a typed button with the variant and size classes', () => {
    render(
      <Button variant="destructive" size="sm">
        Deactivate
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Deactivate' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('destructive');
    expect(button.className).toContain('sm');
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TextField and SelectField', () => {
  it('links the label and shows a field-level error', () => {
    render(<TextField label="Registration code" error="A horse with this registration code already exists." />);
    const input = screen.getByLabelText('Registration code');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('A horse with this registration code already exists.');
  });

  it('renders the placeholder option and the given options', async () => {
    const onChange = vi.fn();
    render(
      <SelectField
        label="Vai trò"
        placeholder="Select role"
        defaultValue=""
        onChange={onChange}
        options={[
          { value: 'TRAINER', label: 'Trainer' },
          { value: 'GROOM', label: 'Groom / Stable Hand' },
        ]}
      />,
    );
    const select = screen.getByLabelText('Vai trò');
    expect(screen.getByRole('option', { name: 'Select role' })).toBeInTheDocument();
    await userEvent.selectOptions(select, 'GROOM');
    expect(onChange).toHaveBeenCalled();
    expect(select).toHaveValue('GROOM');
  });
});

describe('AlertBanner and MetricCard', () => {
  it('announces danger banners as alerts', () => {
    render(<AlertBanner type="danger" title="CRITICAL — Heart rate 186 > 180 threshold" />);
    expect(screen.getByRole('alert')).toHaveTextContent('CRITICAL');
  });

  it('shows the realtime state with an icon and text, not colour alone', () => {
    const { container } = render(
      <MetricCard label="Nhịp tim" value="186 bpm" caption="Critical — above 180 bpm threshold" realtimeState="critical" />,
    );
    expect(screen.getByText('Critical — above 180 bpm threshold')).toBeInTheDocument();
    expect(container.querySelector('[data-icon="alert-octagon"]')).not.toBeNull();
  });
});

describe('Tabs', () => {
  function ControlledTabs() {
    const [value, setValue] = useState('overview');
    return (
      <Tabs
        label="Sections"
        value={value}
        onChange={setValue}
        items={[
          { value: 'overview', label: 'Tổng quan' },
          { value: 'progress', label: 'Tiến độ' },
          { value: 'history', label: 'Lịch sử' },
        ]}
      />
    );
  }

  it('selects tabs by click and arrow keys', async () => {
    render(<ControlledTabs />);
    const overview = screen.getByRole('tab', { name: 'Tổng quan' });
    expect(overview).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Tiến độ' }));
    expect(screen.getByRole('tab', { name: 'Tiến độ' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Lịch sử' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Lịch sử' })).toHaveFocus();
  });
});

describe('Đường dẫn trang', () => {
  it('links parents and marks the last item as the current page', () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: 'Huấn luyện', to: '/training' }, { label: 'Thunder Bolt' }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Huấn luyện' })).toHaveAttribute('href', '/training');
    expect(screen.getByText('Thunder Bolt')).toHaveAttribute('aria-current', 'page');
  });
});

describe('WizardStepper', () => {
  it('lets only completed steps be clicked', async () => {
    const onStepClick = vi.fn();
    render(<WizardStepper steps={['Ngựa', 'Hồ sơ', 'Mục tiêu', 'Giai đoạn']} currentStep={2} onStepClick={onStepClick} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: /Hồ sơ/ }));
    expect(onStepClick).toHaveBeenCalledWith(1);
    expect(screen.getByText('Mục tiêu').closest('li')).toHaveAttribute('aria-current', 'step');
  });
});

describe('DataTable', () => {
  const columns = [{ key: 'name', header: 'Ngựa', render: (row: { id: number; name: string }) => row.name }];

  it('renders rows and reports row clicks', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[{ id: 1, name: 'Thunder Bolt' }]}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Ngựa' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('row', { name: 'Thunder Bolt' }));
    expect(onRowClick).toHaveBeenCalledWith({ id: 1, name: 'Thunder Bolt' });
  });

  it('renders the empty state across all columns', () => {
    render(
      <DataTable columns={columns} rows={[]} rowKey={(row) => row.id} empty={<EmptyState title="No horses yet." />} />,
    );
    expect(screen.getByText('No horses yet.').closest('td')).toHaveAttribute('colspan', '1');
  });
});

describe('Modal', () => {
  it('opens as a labelled dialog and closes through onClose', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Mở</Button>
          <Modal open={open} onClose={() => setOpen(false)} title="Assign stable box">
            Body
          </Modal>
        </>
      );
    }
    render(<Harness />);
    expect(screen.queryByText('Body')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mở' }));
    expect(screen.getByRole('dialog', { name: 'Assign stable box' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByText('Body')).not.toBeInTheDocument();
  });
});
