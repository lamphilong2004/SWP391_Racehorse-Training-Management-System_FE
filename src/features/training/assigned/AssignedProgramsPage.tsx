import { useMemo, useState } from 'react';
import { ButtonLink, AlertBanner, Button, Card, DataTable, EmptyState, Icon, SelectField, StatusBadge, TextField } from '../../../design-system';
import { useSupportingApi, useSupportingLoad, dateRange } from './supportingHooks';
import { SupportingReadState, SupportingShell } from './SupportingShell';
import type { AssignedProgram, SupportingApi } from './supportingApi';
import styles from './supporting.module.css';
import { useAuth } from '../../../shared/auth/AuthProvider';
import { viLabel } from '../../../shared/viLabels';

// Vietnamese nouns do not inflect for number.
/** Figma 95:400 date format: "Tue 20 Oct · 06:00". */
const nextLabel = (value: string) => { const date = new Date(value); return `${date.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`; };

export function AssignedProgramsPage({ api: supplied }: { api?: SupportingApi }) {
  const api = useSupportingApi(supplied);
  return <SupportingShell title="Chương trình được giao" roles={['TRAINER']}><Programs api={api} /></SupportingShell>;
}
function Programs({ api }: { api: SupportingApi }) {
  const { user } = useAuth();
  const [page, setPage] = useState(0); const [status, setStatus] = useState(''); const [horse, setHorse] = useState('');
  const [phase, setPhase] = useState(''); const [search, setSearch] = useState('');
  const range = useMemo(() => dateRange(new Date()), []);
  const programs = useSupportingLoad(() => api.programs({ page, status, horseId: horse ? Number(horse) : undefined }), [api, page, status, horse]);
  const sessions = useSupportingLoad(() => api.sessions(range), [api, range]);
  const rows = (programs.data?.items ?? []).filter((item) => (!phase || item.currentPhaseName === phase) && `${item.horse.name} ${item.horse.horseCode} ${item.name}`.toLowerCase().includes(search.toLowerCase()));
  const horses = [...new Map((programs.data?.items ?? []).map((item) => [item.horse.id, item.horse])).values()];
  const phases = [...new Set((programs.data?.items ?? []).flatMap((item) => item.currentPhaseName ? [item.currentPhaseName] : []))];
  const nextSession = (program: AssignedProgram) => (sessions.data ?? []).filter((session) => session.programId === program.id && session.status === 'SCHEDULED' && Date.parse(session.scheduledStart) >= Date.now()).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0];
  return <div className={styles.stack}><div className={styles.header}><div><h1 className={styles.title}>Chương trình được giao cho tôi</h1><p className={styles.muted}>Các chương trình huấn luyện được giao cho bạn — mỗi chương trình tạo từ một mẫu chương trình.</p></div><span className={styles.notice}><Icon name="info" size={14} />Chương trình do Head Trainer tạo và điều chỉnh</span></div>
    <Card><div className={styles.filters}><TextField label="Tìm ngựa hoặc chương trình" type="search" placeholder="Tìm trên trang hiện tại…" value={search} onChange={(event) => setSearch(event.target.value)} /><SelectField label="Trạng thái chương trình" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); setPhase(''); }} options={[{ value: '', label: 'Tất cả' }, ...['ACTIVE', 'PAUSED', 'COMPLETED'].map((value) => ({ value, label: viLabel(value) }))]} /><SelectField label="Ngựa" value={horse} onChange={(event) => { setHorse(event.target.value); setPage(0); }} options={[{ value: '', label: 'Tất cả' }, ...horses.map((item) => ({ value: String(item.id), label: item.name }))]} /><SelectField label="Giai đoạn hiện tại" value={phase} onChange={(event) => setPhase(event.target.value)} options={[{ value: '', label: 'Tất cả' }, ...phases.map((value) => ({ value, label: viLabel(value) }))]} />{programs.data && <span className={styles.count}>{`${programs.data.totalItems} chương trình`}{programs.data.totalPages <= 1 ? ` · ${programs.data.items.filter((item) => item.status === 'ACTIVE').length} đang hoạt động` : ''}</span>}<Button type="button" variant="tertiary" disabled={!search && !status && !horse && !phase && page === 0} onClick={() => { setSearch(''); setStatus(''); setHorse(''); setPhase(''); setPage(0); }}>Xóa bộ lọc</Button></div>
      <SupportingReadState error={programs.error} loading={!programs.data} retry={programs.retry} />
      {programs.data && <><div className={styles.tableWrap}><DataTable<AssignedProgram> caption="Chương trình được giao cho tôi" rows={rows} rowKey={(row) => row.id} empty={<EmptyState title="Chưa có chương trình được giao" description="Không có chương trình phù hợp với trang và bộ lọc này." />} columns={[
        { key: 'horse', header: 'Ngựa', render: (item) => <div className={styles.smallStack}><span className={styles.strong}>{item.horse.name}</span><span className={styles.caption}>{item.horse.horseCode}</span>{item.trainingAvailability && <StatusBadge family="availability" status={item.trainingAvailability} />}</div> },
        { key: 'program', header: 'Chương trình', render: (item) => item.name },
        { key: 'goal', header: 'Mục tiêu', render: () => <span className={styles.caption}>Chưa cung cấp</span> },
        { key: 'phase', header: 'Giai đoạn hiện tại', render: (item) => item.currentPhaseName ?? 'Chưa cung cấp' },
        { key: 'progress', header: 'Tiến độ', render: () => <span className={styles.caption}>Chưa cung cấp</span> },
        { key: 'next', header: 'Buổi tập tiếp theo', render: (item) => { const next = nextSession(item); return next ? <div className={styles.cellStack}><ButtonLink to={`/training/session/${next.id}`}>{nextLabel(next.scheduledStart)}</ButtonLink><span className={styles.caption}>{next.sessionCode}</span></div> : <span className={styles.caption}>{sessions.error ? 'Không có' : 'Không có trong 30 ngày tới'}</span>; } },
        { key: 'status', header: 'Trạng thái chương trình', render: (item) => <StatusBadge family="program" status={item.status} /> },
        { key: 'actions', header: 'Thao tác', render: (item) => <div className={styles.actions}><ButtonLink aria-label={`Xem chương trình ${item.name}`} to={`/training/programs/${item.id}`}><Icon name="eye" size={16} />Xem chương trình</ButtonLink>{item.status === 'ACTIVE' && item.trainingAvailability && item.trainingAvailability !== 'LOCKED' ? <ButtonLink to={`/training/schedule/session/new?programId=${item.id}`}>+ Thêm buổi tập</ButtonLink> : <span className={styles.disabledAction} aria-disabled="true" title="Chỉ thêm buổi tập được cho chương trình đang hoạt động và ngựa không bị khóa tập luyện."><Icon name="plus" size={16} />Thêm buổi tập</span>}</div> },
      ]} /></div><div className={styles.footer}><p className={styles.caption}>Đang hiển thị {`${rows.length} chương trình trên trang này`} · {programs.data.totalItems} chương trình phù hợp bộ lọc máy chủ được giao cho {user?.fullName ?? 'you'}{programs.data.totalPages > 1 ? ' · tìm kiếm và lọc giai đoạn chỉ áp dụng cho trang hiện tại' : ''}</p><p className={styles.caption}>Chỉ thêm buổi tập được cho chương trình đang hoạt động và ngựa không bị khóa tập luyện.</p></div>{programs.data.totalPages > 1 && <div className={styles.header}><span /><div className={styles.actions}><Button variant="secondary" disabled={page === 0} onClick={() => setPage((old) => old - 1)}>Trước</Button><span>Trang {page + 1}/{Math.max(1, programs.data.totalPages)}</span><Button variant="secondary" disabled={page + 1 >= programs.data.totalPages} onClick={() => setPage((old) => old + 1)}>Sau</Button></div></div>}</>}
    </Card><AlertBanner type="info" title="Mục tiêu và tiến độ">Mục tiêu và tiến độ chương trình sẽ hiện khi hệ thống cung cấp. Lên lịch buổi tập bằng nút + Thêm buổi tập.</AlertBanner>
  </div>;
}
