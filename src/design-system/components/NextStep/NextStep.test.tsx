import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { NextStep, NextStepPanel } from './NextStep';

describe('NextStep', () => {
  it('names the next action and its owner, with a direct link only when given', () => {
    const { rerender } = render(<MemoryRouter><NextStepPanel title="Đánh giá buổi tập" owner="Trainer · Hà Linh" action={{ label: 'Mở buổi tập', to: '/training/session/7' }}><p>Trainer chốt đánh giá.</p></NextStepPanel></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Bước tiếp theo: Đánh giá buổi tập' })).toBeInTheDocument();
    expect(screen.getByText('Người phụ trách: Trainer · Hà Linh')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở buổi tập' })).toHaveAttribute('href', '/training/session/7');

    rerender(<MemoryRouter><NextStepPanel title="Khám sức khỏe ban đầu" owner="Veterinarian" /></MemoryRouter>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  it('is hidden in the product (toasts confirm actions instead)', () => {
    const { container } = render(<MemoryRouter><NextStep title="Đánh giá buổi tập" owner="Trainer" /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
