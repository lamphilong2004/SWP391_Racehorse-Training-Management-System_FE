import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ErrorState, LoadingState, Modal, RadioGroup, SelectField, TextField } from '../../../design-system';
import type { HorsesApi } from '../api/horsesApi';
import type { HorseDetail, Page } from '../api/types';
import styles from '../shared/horses.module.css';

/** Explicit record selection; identical horse names must never determine a parent identity. */
export function HorseRecordPicker({ api, kind, horseId, otherParentId, onClose, onSelected }: {
  api: Pick<HorsesApi, 'listHorses'>; kind: 'sire' | 'dam' | 'medical'; horseId?: number;
  otherParentId?: number;
  onClose: () => void; onSelected: (horse: HorseDetail) => void;
}) {
  const label = kind === 'medical' ? 'ngựa' : kind === 'sire' ? 'ngựa cha' : 'ngựa mẹ';
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Page<HorseDetail>>();
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [lastSearch, setLastSearch] = useState({ q: '', page: 0 });
  const request = useRef(0);
  const mounted = useRef(true);

  const search = useCallback(async (q: string, page: number) => {
    const ticket = ++request.current;
    setLoading(true); setError(undefined); setSelected(''); setLastSearch({ q, page });
    try {
      const result = await api.listHorses({ q: q.trim() || undefined, page, size: 20 });
      if (mounted.current && request.current === ticket) setData(result);
    } catch (cause) {
      if (mounted.current && request.current === ticket) { setData(undefined); setError(cause instanceof Error ? cause.message : 'Không tải được danh sách ngựa.'); }
    } finally { if (mounted.current && request.current === ticket) setLoading(false); }
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const ticket = ++request.current;
    api.listHorses({ page: 0, size: 20 }).then(result => {
      if (active && request.current === ticket) { setData(result); setLoading(false); }
    }, cause => {
      if (active && request.current === ticket) { setError(cause instanceof Error ? cause.message : 'Không tải được danh sách ngựa.'); setLoading(false); }
    });
    return () => { active = false; mounted.current = false; };
  }, [api]);

  const candidates = data?.items.filter(horse => horse.id !== horseId && horse.id !== otherParentId) ?? [];
  const options = candidates.map(horse => ({ value: String(horse.id), label: `${horse.name} · ${horse.horseCode}` }));
  const chosen = candidates.find(horse => String(horse.id) === selected);
  return <Modal open title={`Chọn ${label} từ hồ sơ`} onClose={onClose} footer={<>
    <Button variant="secondary" onClick={onClose}>Hủy</Button>
    <Button disabled={!chosen || loading || !!error} onClick={() => chosen && onSelected(chosen)}>Dùng hồ sơ đã chọn</Button>
  </>}>
    <div className={styles.parentPicker}>
      <p>Chọn hồ sơ theo tên và mã ngựa. {kind !== 'medical' && 'Ngựa ngoài hệ thống vẫn có thể khai báo bằng tên ở biểu mẫu chính.'}</p>
      <div className={styles.parentSearch}>
        <TextField label="Tìm ngựa theo tên hoặc mã" type="search" maxLength={150} value={query} onChange={event => setQuery(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void search(query, 0); } }} />
        <Button variant="secondary" disabled={loading} onClick={() => void search(query, 0)}>Tìm ngựa</Button>
      </div>
      {loading && <LoadingState label="Đang tìm hồ sơ ngựa…" />}
      {error && <ErrorState title="Không tải được danh sách ngựa" description={error} onRetry={() => void search(lastSearch.q, lastSearch.page)} />}
      {!loading && !error && data && <>
        {options.length === 0 ? <p role="status">Không có hồ sơ phù hợp trên trang này. Hãy đổi từ khóa hoặc xem trang tiếp theo.</p>
          : kind === 'medical' ? <SelectField label={`Hồ sơ ${label}`} placeholder="Chọn đúng tên và mã ngựa" value={selected}
              options={options} onChange={event => setSelected(event.target.value)} />
          : <div className={styles.parentResults}><RadioGroup label={`Hồ sơ ${label}`} options={options} value={selected} onChange={setSelected} /></div>}
        <div className={styles.parentPagination}>
          <Button variant="secondary" disabled={data.page === 0} onClick={() => void search(lastSearch.q, data.page - 1)}>Trang trước</Button>
          <span role="status">Trang {data.page + 1}/{Math.max(1, data.totalPages)}</span>
          <Button variant="secondary" disabled={data.page + 1 >= data.totalPages} onClick={() => void search(lastSearch.q, data.page + 1)}>Trang sau</Button>
        </div>
      </>}
    </div>
  </Modal>;
}
