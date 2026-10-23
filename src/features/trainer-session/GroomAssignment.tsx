import { useCallback, useRef, useState } from 'react';
import { AlertBanner, Button, ErrorState, SelectField } from '../../design-system';
import { errorMessage } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import type { createSessionApi, TrainingSession } from './sessionApi';

/** Leader-authorized CORE-026 control inside the approved Session Detail staff card. */
export function GroomAssignment({ api, session, onSaved }: { api: ReturnType<typeof createSessionApi>; session: TrainingSession; onSaved: () => void }) {
  const load = useCallback((signal: AbortSignal) => api.groomCandidates(session.id, signal), [api, session.id]);
  const candidates = useResource(load);
  const [selected, setSelected] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function save() {
    if (pending.current || !selected) return;
    pending.current = true; setBusy(true); setError('');
    try { await api.assignGroom(session.id, Number(selected)); onSaved(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <>
    {candidates.error && <ErrorState title="Không tải được danh sách Groom" description={candidates.error} onRetry={candidates.reload} />}
    {error && <AlertBanner type="danger" title="Chưa xác nhận được phân công">{error}</AlertBanner>}
    <SelectField label="Phân công Groom" placeholder="Chọn một Groom đang hoạt động" value={selected} disabled={busy || candidates.pending}
      options={(Array.isArray(candidates.data) ? candidates.data : []).map((groom) => ({ value: String(groom.id), label: groom.fullName }))}
      onChange={(event) => setSelected(event.target.value)} />
    <Button disabled={busy || !selected} onClick={() => void save()}>Phân công & thông báo Groom</Button>
  </>;
}
