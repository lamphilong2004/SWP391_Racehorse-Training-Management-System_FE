import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { CalendarSession, SupportingApi } from '../assigned/supportingApi';
import { CALENDAR_CARD_HEIGHT, CALENDAR_HOUR_HEIGHT, calendarLayout } from './calendarLayout';
import { TrainingCalendarPage } from './TrainingCalendarPage';

const auth = vi.hoisted(() => ({ user: { fullName: 'Test Trainer', roles: ['TRAINER'] }, handleApiError: () => false }));
vi.mock('../../../shared/auth/AuthProvider', () => ({ useAuth: () => auth }));
function session(id: number, hour: number, minute = 0, endHour?: number): CalendarSession {
  const date = new Date(); date.setHours(hour, minute, 0, 0);
  const end = new Date(date); if (endHour !== undefined) end.setHours(endHour, minute);
  return { id, sessionCode: `SES-${id}`, horse: { id, horseCode: `H-${id}`, name: `Horse ${id}` }, programId: 1001, phaseName: 'Base', scheduledStart: date.toISOString(), scheduledEnd: endHour === undefined ? null : end.toISOString(), status: 'SCHEDULED', workRider: { id: 13, fullName: 'Assigned Rider' }, blocked: false, blockedReasons: [] };
}
it('keeps all six simultaneous sessions in distinct lanes at their actual start time', () => {
  const sessions = Array.from({ length: 6 }, (_, index) => session(42 + index, 10));
  const layout = calendarLayout(sessions);
  expect(layout).toHaveLength(6); expect(new Set(layout.map((entry) => entry.lane)).size).toBe(6);
  expect(layout.map((entry) => entry.session.id)).toEqual(sessions.map((entry) => entry.id));
  for (const entry of layout) { expect(entry.minute).toBe(600); expect(entry.lanes).toBe(6); expect(entry.height).toBe(CALENDAR_CARD_HEIGHT); }
});
it('accounts for minimum readable card height and true long-session duration, then reuses full width after a cluster', () => {
  const layout = calendarLayout([session(1, 10, 0, 13), session(2, 10, 5), session(3, 11), session(4, 16)]);
  expect(layout[0].height).toBe(3 * CALENDAR_HOUR_HEIGHT);
  expect(layout[1].minute).toBe(605); expect(layout[2].minute).toBe(660);
  for (let i = 0; i < layout.length; i++) for (let j = i + 1; j < layout.length; j++) {
    const a = layout[i], b = layout[j];
    const overlaps = a.minute / 60 * CALENDAR_HOUR_HEIGHT + a.height > b.minute / 60 * CALENDAR_HOUR_HEIGHT;
    if (overlaps) expect(a.lane).not.toBe(b.lane);
  }
  expect(layout.at(-1)).toMatchObject({ lane: 0, lanes: 1, minute: 960 });
});
it('renders every overlapping event with separate horizontal positions and aligned day headers; all remain actionable', async () => {
  const sessions = Array.from({ length: 6 }, (_, index) => session(42 + index, 10));
  const api: SupportingApi = { programs: vi.fn(), sessions: vi.fn().mockResolvedValue(sessions), exercises: vi.fn(), exercise: vi.fn(), saveExercise: vi.fn() };
  const router = createMemoryRouter([{ path: '/training/schedule', element: <TrainingCalendarPage api={api} /> }, { path: '/training/session/:id', element: <h1>Session detail handoff</h1> }], { initialEntries: ['/training/schedule'] });
  render(<RouterProvider router={router} />);
  const events = await screen.findAllByRole('button', { name: /^Open SES-/ });
  expect(events).toHaveLength(6); expect(new Set(events.map((entry) => entry.style.left)).size).toBe(6);
  for (const [index, event] of events.entries()) {
    expect(event).toHaveAttribute('data-calendar-session', String(42 + index)); expect(event).toHaveAttribute('data-calendar-lanes', '6');
    expect(event).toHaveStyle({ top: '256px', height: `${CALENDAR_CARD_HEIGHT}px` }); expect(event).toHaveTextContent('10:00');
  }
  const body = events[0].parentElement!.parentElement!;
  const header = body.previousElementSibling as HTMLElement;
  expect(body.style.gridTemplateColumns).toBe(header.style.gridTemplateColumns); expect(body.style.gridTemplateColumns).toContain('minmax(900px, 1fr)');
  expect(Number.parseInt(body.style.minWidth)).toBeGreaterThan(1400);
  fireEvent.click(events[5]); await screen.findByRole('heading', { name: 'Session detail handoff' }); expect(router.state.location.pathname).toBe('/training/session/47');
});
