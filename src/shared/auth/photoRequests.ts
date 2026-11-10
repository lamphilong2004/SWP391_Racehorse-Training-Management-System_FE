// Photos share the API origin with forms and business reads. Leave capacity for those requests.
// No image/token cache: every request still goes through current server authorization.
const MAX_CONCURRENT_PHOTOS = 2;
let active = 0;
const queue: (() => void)[] = [];

function drain() {
  while (active < MAX_CONCURRENT_PHOTOS && queue.length) queue.shift()!();
}

export function scheduleHorsePhoto<T>(request: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      const index = queue.indexOf(start);
      if (index >= 0) queue.splice(index, 1);
      signal.removeEventListener('abort', abort);
      reject(new DOMException('Photo request was cancelled.', 'AbortError'));
    };
    const start = () => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) { abort(); return; }
      active += 1;
      // Hold the slot until response.blob() completes as well as the response headers.
      Promise.resolve().then(request).then(resolve, reject).finally(() => { active -= 1; drain(); });
    };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    queue.push(start);
    drain();
  });
}
