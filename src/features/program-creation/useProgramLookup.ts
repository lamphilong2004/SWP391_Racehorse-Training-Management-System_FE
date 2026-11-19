import { useEffect, useState } from 'react';

/** Aborts/ignores outdated catalog searches so a late response cannot replace a newer selection list. */
export function useProgramLookup<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data: T | null; pending: boolean; error: unknown }>({ data: null, pending: true, error: null });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      // Effect có thể đã cleanup trước microtask này; khi đó không khởi chạy request hay cập nhật state.
      if (!active) return;
      setState({ data: null, pending: true, error: null });
      try {
        const data = await load(controller.signal);
        if (active) setState({ data, pending: false, error: null });
      } catch (error) {
        if (active) setState({ data: null, pending: false, error });
      }
    });
    // Abort tiết kiệm request; active vẫn chặn kết quả từ loader không tuân theo AbortSignal.
    return () => { active = false; controller.abort(); };
  }, [load, revision]);
  // Đổi revision để chạy lại cùng loader sau lỗi mà không cần đổi bộ lọc hoặc lựa chọn.
  return { ...state, retry: () => setRevision((value) => value + 1) };
}
