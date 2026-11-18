import { useCallback, useState } from 'react';
import { ActionBar, AlertBanner, Button, ButtonLink, Card, DataTable, EmptyState, ErrorState, LoadingState, SelectField, StatusBadge, TableToolbar, TextField } from '../../design-system';
import { ROUTES } from '../../app/routePaths';
import { FlowShell } from '../main-flows/FlowShell';
import { useResource } from '../main-flows/useResource';
import type { AssignedProgram, ProgramStatus } from '../training/assigned/supportingApi';
import { useProgramCreationApi } from './programTransport';
import styles from '../main-flows/flow.module.css';
import { viLabel } from '../../shared/viLabels';
import { formatDate } from '../horses/shared/format';

/** CORE-022 / SCR-TRAIN-001 (77:317). List reads only; the existing wizard owns creation. */
export function ProgramListPage() {
  const api = useProgramCreationApi();
  const [page, setPage] = useState(0), [status, setStatus] = useState<ProgramStatus | ''>('');
  const [search, setSearch] = useState(''), [trainer, setTrainer] = useState(''), [horse, setHorse] = useState('');
  const load = useCallback((signal: AbortSignal) => api.listPrograms({ page, status: status || undefined }, signal), [api, page, status]);
  const resource = useResource(load), data = resource.data;
  const rows = (data?.items ?? []).filter((item) => (!trainer || String(item.currentTrainer?.id) === trainer) && (!horse || String(item.horse.id) === horse)
    && `${item.horse.name} ${item.horse.horseCode} ${item.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  const trainers = [...new Map((data?.items ?? []).flatMap((item) => item.currentTrainer ? [[item.currentTrainer.id, item.currentTrainer] as const] : [])).values()];
  const horses = [...new Map((data?.items ?? []).map((item) => [item.horse.id, item.horse])).values()];
  function changePage(next: number) { setPage(next); setTrainer(''); setHorse(''); }
  function clearFilters() { setSearch(''); setStatus(''); changePage(0); }
  return <FlowShell title="Chương trình huấn luyện ngựa" description="Chương trình riêng cho từng ngựa — mỗi chương trình tạo từ một mẫu dùng chung và tùy chỉnh cho một con ngựa." section="Huấn luyện" role="HEAD_TRAINER" actions={<ButtonLink variant="primary" to={ROUTES.trainingProgramCreate}>+ Tạo chương trình huấn luyện</ButtonLink>}>
    <Card>
      <SelectField className="w-full sm:max-w-xs" label="Trạng thái" helperText="Áp dụng cho toàn bộ danh sách."
        value={status} options={[{ value: '', label: 'Tất cả' }, ...['ACTIVE', 'PAUSED', 'COMPLETED'].map((value) => ({ value, label: viLabel(value) }))]}
        onChange={(event) => { setStatus(event.target.value as ProgramStatus | ''); changePage(0); }}
      />
      <TableToolbar label="Bộ lọc chương trình trên trang hiện tại" scope="page"
        resultCount={resource.pending || !data ? undefined : rows.length}
        hasFilters={Boolean(search || status || trainer || horse || page)} onClear={clearFilters}>
        <TextField label="Tìm ngựa hoặc chương trình" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <SelectField label="Trainer" value={trainer} options={[{ value: '', label: 'Tất cả' }, ...trainers.map((item) => ({ value: String(item.id), label: item.fullName }))]} onChange={(event) => setTrainer(event.target.value)} />
        <SelectField label="Ngựa" value={horse} options={[{ value: '', label: 'Tất cả' }, ...horses.map((item) => ({ value: String(item.id), label: item.name }))]} onChange={(event) => setHorse(event.target.value)} />
      </TableToolbar>
      {resource.pending && <LoadingState label="Đang tải chương trình huấn luyện…" />}
      {resource.error && <ErrorState title="Không tải được chương trình" description={resource.error} onRetry={resource.reload} />}
      {data && <><DataTable<AssignedProgram> caption="Chương trình huấn luyện ngựa" rows={rows} rowKey={(item) => item.id} empty={<EmptyState title="Không có chương trình phù hợp" description="Đổi bộ lọc hoặc tạo chương trình huấn luyện mới." />} columns={[
        { key: 'horse', header: 'Ngựa', render: (item) => <><strong>{item.horse.name}</strong><p className="text-caption">{item.horse.horseCode}</p>{item.trainingAvailability && <StatusBadge family="availability" status={item.trainingAvailability} />}</> },
        { key: 'program', header: 'Chương trình', render: (item) => <>{item.name}<p className="text-caption">Mẫu chương trình {item.sourceTemplateId} · v{item.sourceTemplateVersion}</p></> },
        { key: 'trainer', header: 'Trainer', render: (item) => item.currentTrainer?.fullName ?? 'Chưa cung cấp' },
        { key: 'phase', header: 'Giai đoạn hiện tại', render: (item) => item.currentPhaseName ?? 'Chưa cung cấp' },
        { key: 'period', header: 'Thời gian', render: (item) => <span className={styles.period}><span>{formatDate(item.periodStart)}</span><span>→ {formatDate(item.periodEnd)}</span></span> },
        { key: 'status', header: 'Trạng thái', render: (item) => <StatusBadge family="program" status={item.status} /> },
        { key: 'detail', header: 'Chi tiết', render: (item) => <ButtonLink to={`/training/programs/${item.id}`} aria-label={`Xem ${item.name}`}>Xem</ButtonLink> },
      ]} />
        <ActionBar leading={<span>Trang {page + 1}/{Math.max(1, data.totalPages)} · {data.totalItems} chương trình phù hợp bộ lọc trạng thái</span>}>
          <Button variant="secondary" disabled={page === 0} onClick={() => changePage(page - 1)}>Chương trình trước</Button>
          <Button variant="secondary" disabled={page + 1 >= data.totalPages} onClick={() => changePage(page + 1)}>Chương trình tiếp</Button>
        </ActionBar>
      </>}
    </Card>
    <AlertBanner type="info" title="Tóm tắt chương trình">Danh sách chưa có mục tiêu, tiến độ và số liệu tóm tắt. Hãy mở từng chương trình để xem chi tiết.</AlertBanner>
    <p className="text-caption">Khả năng tập luyện do Veterinarian đặt, tách biệt với trạng thái chương trình.</p>
  </FlowShell>;
}
