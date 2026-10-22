import { connectSessionStream, monitoringSocketUrl } from './sessionStream';

it('keeps same-origin secure WebSockets on HTTPS and supports configured API origins', () => {
  expect(monitoringSocketUrl('https://api.example.test')).toBe('wss://api.example.test/ws');
  expect(monitoringSocketUrl('/')).toBe(new URL('/ws', location.origin).toString().replace(/^http/, 'ws'));
});

class FakeSocket {
  sent: string[] = []; binaryType = ''; readyState = 1;
  onopen: (() => void) | null = null; onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null; onclose: (() => void) | null = null;
  send(frame: string) { this.sent.push(frame); }
  close() { this.readyState = 3; this.onclose?.(); }
  receive(frame: string) { this.onmessage?.({ data: frame }); }
}
it('authenticates in CONNECT, subscribes after acceptance, validates session scope and cleans up', () => {
  const socket = new FakeSocket(), events = vi.fn(), status = vi.fn();
  const createSocket = vi.fn(() => socket as unknown as WebSocket);
  const stop = connectSessionStream({ sessionId: 42, token: 'test-jwt', onEvent: events, onStatus: status, createSocket, url: 'ws://localhost/ws' });
  socket.onopen?.(); expect(socket.sent[0]).toContain('Authorization:Bearer test-jwt'); expect(createSocket.mock.calls[0]).toEqual(['ws://localhost/ws', ['v12.stomp']]);
  expect(socket.sent.some((frame) => frame.startsWith('SUBSCRIBE'))).toBe(false);
  socket.receive('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0');
  expect(socket.sent.filter((frame) => frame.startsWith('SUBSCRIBE'))).toHaveLength(3);
  const message = (sessionId: number) => `MESSAGE\nsubscription:metrics\n\n${JSON.stringify({ sessionId, heartRate: 120, source: 'MANUAL' })}\0`;
  socket.receive(message(99)); expect(events).not.toHaveBeenCalled();
  const frame = message(42); socket.receive(frame.slice(0, 15)); socket.receive(frame.slice(15)); expect(events).toHaveBeenCalledTimes(1);
  stop(); expect(socket.sent.filter((frame) => frame.startsWith('UNSUBSCRIBE'))).toHaveLength(3); expect(socket.sent.some((frame) => frame.startsWith('SEND'))).toBe(false);
  expect(socket.onmessage).toBeNull(); expect(socket.readyState).toBe(3);
});
it('surfaces refused subscriptions and never sends telemetry or the JWT in the URL', () => {
  const socket = new FakeSocket(), status = vi.fn(), createSocket = vi.fn(() => socket as unknown as WebSocket);
  const stop = connectSessionStream({ sessionId: 42, token: 'test-jwt', onEvent: vi.fn(), onStatus: status, createSocket, url: 'wss://api.example.test/ws' });
  socket.onopen?.(); socket.receive('ERROR\nmessage:Forbidden\n\nSubscription refused\0');
  expect(status).toHaveBeenLastCalledWith('Unavailable', expect.stringContaining('refused'));
  expect(createSocket).toHaveBeenCalledWith('wss://api.example.test/ws', ['v12.stomp']);
  expect(socket.sent.some((frame) => frame.startsWith('SEND'))).toBe(false); stop();
});
it('reports a lost negotiated server heartbeat and clears its timers on cleanup', () => {
  vi.useFakeTimers();
  try {
    const socket = new FakeSocket(), status = vi.fn();
    const stop = connectSessionStream({ sessionId: 42, token: 'test-jwt', onEvent: vi.fn(), onStatus: status, createSocket: () => socket as unknown as WebSocket, url: 'wss://api.example.test/ws' });
    socket.onopen?.(); socket.receive('CONNECTED\nversion:1.2\nheart-beat:10000,0\n\n\0');
    vi.advanceTimersByTime(30000);
    expect(status).toHaveBeenLastCalledWith('Unavailable', expect.stringContaining('heartbeat lost'));
    stop(); expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});
