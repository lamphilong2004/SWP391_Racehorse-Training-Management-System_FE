/**
 * DEMO INTEGRATION: minimal STOMP 1.2 client over a native WebSocket (flow2-stomp.md). Subscribe-only.
 * Sends the JWT in the CONNECT frame, reconnects with back-off, and re-subscribes after reconnect.
 * Clients must reload REST state after a reconnect (REST is the source of truth).
 */
type Handler = (body: unknown) => void;

export interface StompConnection {
  subscribe(destination: string, handler: Handler): () => void;
  close(): void;
  onStatus(listener: (status: 'connecting' | 'connected' | 'disconnected') => void): () => void;
}

export function connectStomp(token: string): StompConnection {
  const subs = new Map<string, { destination: string; handler: Handler }>();
  const statusListeners = new Set<(s: 'connecting' | 'connected' | 'disconnected') => void>();
  let socket: WebSocket | null = null;
  let closed = false;
  let connected = false;
  let attempt = 0;
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const emit = (s: 'connecting' | 'connected' | 'disconnected') => statusListeners.forEach((l) => l(s));
  const frame = (command: string, headers: Record<string, string>, body = '') =>
    `${command}\n${Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n')}\n\n${body}\0`;

  const url = (() => {
    const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) || window.location.origin;
    return base.replace(/^http/, 'ws') + '/ws';
  })();

  const sendSubscribe = (id: string, destination: string) => {
    if (socket && connected) socket.send(frame('SUBSCRIBE', { id, destination, ack: 'auto' }));
  };

  const open = () => {
    if (closed) return;
    emit('connecting');
    try {
      socket = new WebSocket(url);
    } catch {
      schedule();
      return;
    }
    socket.onopen = () => {
      socket?.send(frame('CONNECT', { 'accept-version': '1.2', 'heart-beat': '0,0', Authorization: `Bearer ${token}` }));
    };
    socket.onmessage = (event) => {
      const chunks = String(event.data).split('\0').filter((c) => c.trim().length > 0);
      for (const chunk of chunks) {
        const sep = chunk.indexOf('\n\n');
        const head = (sep >= 0 ? chunk.slice(0, sep) : chunk).replace(/^\n+/, '').split('\n');
        const body = sep >= 0 ? chunk.slice(sep + 2) : '';
        const command = head[0];
        const headers = Object.fromEntries(head.slice(1).map((h) => [h.slice(0, h.indexOf(':')), h.slice(h.indexOf(':') + 1)]));
        if (command === 'CONNECTED') {
          connected = true;
          attempt = 0;
          emit('connected');
          subs.forEach((s, id) => sendSubscribe(id, s.destination));
        } else if (command === 'MESSAGE') {
          const sub = subs.get(headers.subscription);
          if (!sub) continue;
          try {
            sub.handler(JSON.parse(body));
          } catch {
            /* ignore malformed frames */
          }
        }
      }
    };
    socket.onclose = () => {
      connected = false;
      emit('disconnected');
      schedule();
    };
    socket.onerror = () => {
      /* onclose follows */
    };
  };

  const schedule = () => {
    if (closed) return;
    attempt += 1;
    timer = setTimeout(open, Math.min(10000, 500 * 2 ** Math.min(attempt, 5)));
  };

  open();

  return {
    subscribe(destination, handler) {
      const id = `sub-${++seq}`;
      subs.set(id, { destination, handler });
      sendSubscribe(id, destination);
      return () => {
        subs.delete(id);
        if (socket && connected) socket.send(frame('UNSUBSCRIBE', { id }));
      };
    },
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      try {
        if (socket && connected) socket.send(frame('DISCONNECT', {}));
        socket?.close();
      } catch {
        /* already closed */
      }
    },
    onStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
  };
}
