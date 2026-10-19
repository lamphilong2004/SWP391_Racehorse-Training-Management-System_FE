import { resolveApiBase } from '../../shared/apiOrigin';

export interface StreamEvent { topic: 'metrics' | 'alerts' | 'state'; data: Record<string, unknown> }
export type StreamStatus = 'Connecting' | 'Connected' | 'Disconnected' | 'Unavailable';
const TOPICS = ['metrics', 'alerts', 'state'] as const;
export function monitoringSocketUrl(base = resolveApiBase(import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8080' : ''), import.meta.env.DEV)): string {
  const url = new URL(base || '/', globalThis.location?.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws'; url.search = ''; url.hash = ''; return url.toString();
}
/** STOMP 1.2 subscribe-only client for the three approved JSON session topics. No SEND, token in URL or telemetry simulation. */
export function connectSessionStream(options: {
  sessionId: number; token: string; onEvent: (event: StreamEvent) => void; onStatus: (status: StreamStatus, message?: string) => void;
  createSocket?: (url: string, protocols: string[]) => WebSocket; url?: string;
}) {
  if (!Number.isSafeInteger(options.sessionId) || options.sessionId < 1 || !options.token || /[\r\n\0]/.test(options.token)) throw new Error('A valid session and sign-in token are required for realtime.');
  let disposed = false, buffer = '', connected = false, failed = false, watchdog: ReturnType<typeof setInterval> | undefined;
  let lastReceived = Date.now();
  options.onStatus('Connecting');
  const socket = (options.createSocket ?? ((url, protocols) => new WebSocket(url, protocols)))(options.url ?? monitoringSocketUrl(), ['v12.stomp']);
  socket.binaryType = 'arraybuffer';
  const send = (command: string, headers: Record<string, string>) => socket.send(`${command}\n${Object.entries(headers).map(([key, value]) => `${key}:${value}`).join('\n')}\n\n\0`);
  const fail = (message: string) => { failed = true; if (!disposed) options.onStatus('Unavailable', message); connected = false; socket.close(); };
  const timeout = setTimeout(() => { if (!connected) fail('The realtime server did not accept the connection.'); }, 10000);
  socket.onopen = () => { if (!disposed) send('CONNECT', { 'accept-version': '1.2', host: new URL(options.url ?? monitoringSocketUrl()).host, Authorization: `Bearer ${options.token}`, 'heart-beat': '0,10000' }); };
  socket.onmessage = (message) => {
    if (disposed) return;
    lastReceived = Date.now();
    buffer += typeof message.data === 'string' ? message.data : new TextDecoder().decode(message.data as ArrayBuffer);
    // Bound one session frame buffer; revisit if the approved protocol introduces payloads above 1 MiB.
    if (buffer.length > 1048576) { fail('The realtime response exceeded the supported frame size.'); return; }
    let end: number;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const frame = buffer.slice(0, end).replace(/^\s+/, '').replace(/\r\n/g, '\n'); buffer = buffer.slice(end + 1);
      const split = frame.indexOf('\n\n'); if (split < 0) continue;
      const lines = frame.slice(0, split).split('\n'), command = lines.shift();
      const headers = Object.fromEntries(lines.map((line) => { const colon = line.indexOf(':'); return [line.slice(0, colon), line.slice(colon + 1)]; }));
      if (command === 'CONNECTED') {
        connected = true; clearTimeout(timeout); options.onStatus('Connected');
        TOPICS.forEach((topic) => send('SUBSCRIBE', { id: topic, destination: `/topic/sessions/${options.sessionId}/${topic}`, ack: 'auto' }));
        const serverHeartbeat = Number(headers['heart-beat']?.split(',')[0]);
        if (serverHeartbeat > 0) watchdog = setInterval(() => { if (Date.now() - lastReceived > Math.max(serverHeartbeat, 10000) * 2) fail('Realtime heartbeat lost. Reconnect to reload the session.'); }, Math.max(serverHeartbeat, 10000));
      } else if (command === 'ERROR') { fail('The server refused the realtime connection or subscription. Reload your session or sign in again.'); }
      else if (command === 'MESSAGE' && connected && TOPICS.includes(headers.subscription as typeof TOPICS[number])) {
        try {
          const data: unknown = JSON.parse(frame.slice(split + 2));
          if (data && typeof data === 'object' && !Array.isArray(data) && (data as Record<string, unknown>).sessionId === options.sessionId)
            options.onEvent({ topic: headers.subscription as StreamEvent['topic'], data: data as Record<string, unknown> });
        } catch { fail('The server returned an unreadable realtime event.'); }
      }
    }
    if (!buffer.trim()) buffer = '';
  };
  socket.onerror = () => { failed = true; if (!disposed) options.onStatus('Unavailable', 'The realtime server is unavailable. Recorded REST data remains labelled as recorded.'); };
  socket.onclose = () => { clearTimeout(timeout); clearInterval(watchdog); if (!disposed && !failed) options.onStatus('Disconnected', 'Realtime disconnected. Reconnect to reload REST data before resubscribing.'); connected = false; };
  return () => {
    disposed = true; clearTimeout(timeout); clearInterval(watchdog);
    try { if (socket.readyState === 1) { TOPICS.forEach((id) => send('UNSUBSCRIBE', { id })); send('DISCONNECT', {}); } }
    catch { /* A socket that closes concurrently needs no further unsubscribe frames. */ }
    socket.onopen = null; socket.onmessage = null; socket.onerror = null; socket.onclose = null; socket.close();
  };
}
