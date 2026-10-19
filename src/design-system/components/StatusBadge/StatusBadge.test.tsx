import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';
import { STATUS_REGISTRY, type StatusFamily } from './statusRegistry';

describe('StatusBadge', () => {
  it('pairs colour with an icon and a text label for every registered status', () => {
    for (const family of Object.keys(STATUS_REGISTRY) as StatusFamily[]) {
      for (const [status, spec] of Object.entries(STATUS_REGISTRY[family])) {
        const { container, unmount } = render(<StatusBadge family={family} status={status as never} />);
        const badge = container.firstElementChild as HTMLElement;
        expect(badge).toHaveTextContent(spec.label);
        expect(badge.querySelector(`[data-icon="${spec.icon}"]`)).not.toBeNull();
        expect(badge.className).toContain(spec.tone);
        unmount();
      }
    }
  });

  it('keeps exactly the statuses drawn in the Figma badge families', () => {
    const families = Object.fromEntries(
      Object.entries(STATUS_REGISTRY).map(([family, statuses]) => [family, Object.keys(statuses)]),
    );
    expect(families).toEqual({
      availability: ['AVAILABLE', 'LIMITED', 'LOCKED'],
      session: ['SCHEDULED', 'BLOCKED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'INTERRUPTED'],
      realtime: ['NORMAL', 'WARNING', 'CRITICAL'],
      simulated: ['SIMULATED'],
      program: ['ACTIVE', 'PAUSED', 'COMPLETED'],
      health: ['FIT', 'MONITORING', 'INJURED', 'QUARANTINED'],
      preventive: ['UPCOMING', 'DUE', 'OVERDUE', 'COMPLETED'],
      incident: ['REPORTED', 'UNDER_REVIEW', 'RESOLVED'],
      lifecycle: ['DRAFT', 'ACTIVE', 'INACTIVE'],
      account: ['ACTIVE', 'INACTIVE'],
    });
  });

  it('shows the human label, not the enum key', () => {
    render(<StatusBadge family="incident" status="UNDER_REVIEW" />);
    expect(screen.getByText('UNDER REVIEW')).toBeInTheDocument();
  });
});
