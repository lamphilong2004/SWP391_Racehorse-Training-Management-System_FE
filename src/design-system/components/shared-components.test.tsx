import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as DesignSystem from '../index';
import { Button } from './Button/Button';
import { CandidateCard } from './CandidateCard/CandidateCard';
import { ChartContainer } from './ChartContainer/ChartContainer';
import { Checkbox } from './Checkbox/Checkbox';
import { ErrorState } from './ErrorState/ErrorState';
import { HorseCard } from './HorseCard/HorseCard';
import { LoadingState } from './LoadingState/LoadingState';
import { NotificationItem } from './NotificationItem/NotificationItem';
import { PhotoAttachmentTile } from './PhotoAttachmentTile/PhotoAttachmentTile';
import { StableBoxTile } from './StableBoxTile/StableBoxTile';
import { ValidationNotice } from './ValidationNotice/ValidationNotice';

describe('design-system barrel', () => {
  it('exports every shared component required by CORE-002', () => {
    const required = [
      'Checkbox',
      'ValidationNotice',
      'ChartContainer',
      'HorseCard',
      'CandidateCard',
      'PhotoAttachmentTile',
      'NotificationItem',
      'LoadingState',
      'ErrorState',
      'EmptyState',
      'StableBoxTile',
    ];
    for (const name of required) {
      expect(DesignSystem).toHaveProperty(name);
    }
  });
});

describe('Checkbox', () => {
  it('toggles and stays labelled', async () => {
    render(<Checkbox label="Ghi nhớ đăng nhập" />);
    const box = screen.getByRole('checkbox', { name: 'Ghi nhớ đăng nhập' });
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByText('Ghi nhớ đăng nhập'));
    expect(box).toBeChecked();
  });

  it('cannot be toggled when disabled', async () => {
    render(<Checkbox label="Locked" disabled />);
    await userEvent.click(screen.getByText('Locked'));
    expect(screen.getByRole('checkbox', { name: 'Locked' })).not.toBeChecked();
  });
});

describe('ValidationNotice', () => {
  it('shows the category label, icon and the cannot-override pill for medical hard blocks', () => {
    const { container } = render(
      <ValidationNotice category="a" title="Exercise not permitted — Gallop" lockNote="Only the Veterinarian can change this.">
        Forbidden by the restriction.
      </ValidationNotice>,
    );
    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent('Loại A · Chặn bắt buộc do y tế');
    expect(notice).toHaveTextContent('Không thể bỏ qua');
    expect(notice).toHaveTextContent('Only the Veterinarian can change this.');
    expect(container.querySelector('[data-icon="shield-alert"]')).not.toBeNull();
  });

  it('renders warnings as status with their actions', () => {
    render(
      <ValidationNotice category="c" title="Previous workload was HIGH" actions={<Checkbox label="I acknowledge this warning" />} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loại C · Cảnh báo / thận trọng');
    expect(screen.queryByText('Không thể bỏ qua')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'I acknowledge this warning' })).toBeInTheDocument();
  });
});

describe('ChartContainer', () => {
  const base = {
    title: 'Heart rate over time',
    seriesLabel: 'Nhịp tim',
    yTicks: [190, 170, 150, 130, 110],
    xLabels: ['0 min', '16 min'],
    threshold: { value: 180, label: 'Threshold 180 bpm' },
  };

  it('plots the series with a threshold label', () => {
    render(<ChartContainer {...base} values={[125, 150, 179]} />);
    expect(screen.getByRole('img', { name: 'Nhịp tim: 125, 150, 179' })).toBeInTheDocument();
    expect(screen.getByText('Threshold 180 bpm')).toBeInTheDocument();
  });

  it('shows the empty state instead of zeroes', () => {
    render(<ChartContainer {...base} values={[]} />);
    expect(screen.getByText('Không có dữ liệu trong khoảng thời gian này')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('HorseCard and CandidateCard', () => {
  it('shows availability as a badge with icon and text', () => {
    const { container } = render(
      <HorseCard
        name="Night Runner"
        meta="NR-007 · Arabian · 6 yrs · Ô C-11"
        availability="LOCKED"
        facts={[{ label: 'Buổi tập tiếp theo', value: 'None — blocked' }]}
        action={<Button variant="tertiary">Xem hồ sơ</Button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Night Runner' })).toBeInTheDocument();
    expect(screen.getByText('Khóa')).toBeInTheDocument();
    expect(container.querySelector('[data-icon="lock"]')).not.toBeNull();
    expect(screen.getByText('None — blocked')).toBeInTheDocument();
  });

  it('lists candidate reasons as label/value pairs without scores', () => {
    render(
      <CandidateCard
        name="Tran Minh Khoa"
        subtitle="Trainer · 6 yrs experience"
        tags={['Sprint']}
        facts={[{ label: 'Chương trình đang hoạt động', value: '2' }]}
        actions={<Button>Chọn</Button>}
      />,
    );
    expect(screen.getByText('TK')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Kỹ năng' })).toHaveTextContent('Sprint');
    expect(screen.getByRole('term')).toHaveTextContent('Chương trình đang hoạt động');
    expect(screen.getByRole('definition')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: 'Chọn' })).toBeInTheDocument();
  });
});

describe('PhotoAttachmentTile', () => {
  it('fires add and remove callbacks', async () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    const { rerender } = render(<PhotoAttachmentTile state="empty" onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: 'Thêm ảnh' }));
    expect(onAdd).toHaveBeenCalled();
    rerender(<PhotoAttachmentTile state="attached" fileName="photo_01.jpg" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa photo_01.jpg' }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('NotificationItem', () => {
  it('marks unread items and hides the dot once read', () => {
    const props = { title: 'Preventive task due', body: 'Vaccination is due today.', time: '08:00' };
    const { rerender } = render(<NotificationItem {...props} read={false} />);
    expect(screen.getByRole('img', { name: 'Chưa đọc' })).toBeInTheDocument();
    rerender(<NotificationItem {...props} read />);
    expect(screen.queryByRole('img', { name: 'Chưa đọc' })).not.toBeInTheDocument();
  });
});

describe('StableBoxTile', () => {
  it('lets free boxes be selected but never occupied ones', async () => {
    const onSelect = vi.fn();
    render(
      <>
        <StableBoxTile boxId="A-12" state="occupied" horseName="Thunder Bolt" onSelect={onSelect} />
        <StableBoxTile boxId="A-13" state="free" onSelect={onSelect} />
        <StableBoxTile boxId="A-14" state="selected" onSelect={onSelect} />
      </>,
    );
    expect(screen.getByText('Thunder Bolt')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: /A-13/ }));
    expect(onSelect).toHaveBeenCalledWith('A-13');
    expect(screen.getByRole('button', { name: /A-14/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('LoadingState and ErrorState', () => {
  it('announces loading politely', () => {
    render(<LoadingState label="Đang tải danh sách ngựa…" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Đang tải danh sách ngựa…');
  });

  it('shows the error with a retry action', async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Horses could not be loaded" description="Try again." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Horses could not be loaded');
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
