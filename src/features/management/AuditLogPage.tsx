import { useCallback, useContext, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ROUTES } from '../../app/routePaths';
import { AlertBanner, Button, Card, ErrorState, LoadingState, SelectField, TextField } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ROLE_CODES, ROLE_LABELS } from '../../shared/auth/roles';
import { AuditTable } from './AuditTable';
import { auditActionOptions, auditTargetOptions } from '../../shared/auditLabels';
import { auditSearchParams, filtersFromQuery, queryFromFilters, readAuditQuery, validateAuditQuery, type AuditFilterErrors } from './auditQuery';
import { ManagementAccess } from './ManagementAccess';
import { ManagementContext } from './ManagementProvider';
import { useManagementResource } from './useManagementResource';
import type { AuditQuery } from './types';
import styles from './Management.module.css';
import { businessDataMode } from '../../shared/data/businessData';

function AuditResults({ query, pageSearch, role }: { query: AuditQuery; pageSearch: string; role: string }) {
  const service = useContext(ManagementContext);
  const [params, setParams] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const load = useCallback((context: Parameters<typeof service.audit>[1]) => service.audit(query, context), [service, query]);
  const resource = useManagementResource(load, revision);
  if (resource.status === 'loading') return <LoadingState label="Đang tải nhật ký…" />;
  if (resource.status === 'error') return <ErrorState title={resource.forbidden ? 'Không có quyền truy cập' : 'Không tải được nhật ký hệ thống'} description={resource.message} onRetry={resource.forbidden ? undefined : () => setRevision((value) => value + 1)} />;
  const data = resource.data;
  const search = pageSearch.trim().toLocaleLowerCase();
  const entries = data.items.filter((entry) => (!role || entry.actorRole === role) && (!search || [entry.actor?.fullName, entry.actor?.userCode, entry.actor?.id, entry.action, entry.targetType, entry.targetId, entry.id].some((value) => value != null && String(value).toLocaleLowerCase().includes(search))));
  const navigatePage = (page: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    setParams(next);
  };
  const start = data.items.length ? data.page * data.size + 1 : 0;
  const end = data.items.length ? data.page * data.size + data.items.length : 0;
  return <Card className={styles.auditCard}>
    <AuditTable entries={entries} emptyTitle={data.totalItems === 0 ? 'Không có bản ghi nhật ký phù hợp bộ lọc' : 'Không có bản ghi phù hợp trên trang này'} />
    <footer className={styles.pagination}>
      <p aria-live="polite">{search || role ? `${entries.length} bản ghi trên trang này · ` : ''}Đang hiển thị {start}–{end} trên {data.totalItems} bản ghi</p>
      <div className={styles.actions}>
        <SelectField className={styles.pageSize} label="Số bản ghi mỗi trang" value={String(query.size)} options={[...new Set([10, 20, 50, 100, query.size])].sort((a, b) => a - b).map((size) => ({ value: String(size), label: String(size) }))} onChange={(event) => { const next = new URLSearchParams(params); next.set('size', event.target.value); next.set('page', '0'); setParams(next); }} />
        <Button variant="secondary" size="sm" onClick={() => setRevision((value) => value + 1)}>Làm mới</Button>
        {data.items.length === 0 && data.page > 0 && <Button variant="secondary" size="sm" onClick={() => navigatePage(0)}>Trang đầu</Button>}
        <Button variant="secondary" size="sm" disabled={data.page <= 0} onClick={() => navigatePage(data.page - 1)}>Trước</Button>
        <span>{data.page > 0 && data.page >= data.totalPages ? 'Trang này không còn tồn tại.' : `Trang ${data.page + 1}/${Math.max(1, data.totalPages)}`}</span>
        <Button variant="secondary" size="sm" disabled={data.page + 1 >= data.totalPages} onClick={() => navigatePage(data.page + 1)}>Sau</Button>
      </div>
    </footer>
  </Card>;
}

function AuditContent({ query }: { query: AuditQuery }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromQuery(query));
  const [errors, setErrors] = useState<AuditFilterErrors>(() => validateAuditQuery(query));
  const [pageSearch, setPageSearch] = useState(params.get('pageSearch') ?? '');
  const [role, setRole] = useState(params.get('pageRole') ?? '');
  const [datesOpen, setDatesOpen] = useState(Boolean(errors.from || errors.to));
  const queryErrors = validateAuditQuery(query);
  const apply = (event: FormEvent) => {
    event.preventDefault();
    const next = queryFromFilters(filters, query.size);
    const validation = validateAuditQuery(next);
    setErrors(validation);
    if (Object.keys(validation).length) {
      if (validation.from || validation.to) setDatesOpen(true);
      return;
    }
    const nextParams = auditSearchParams(next);
    if (pageSearch.trim()) nextParams.set('pageSearch', pageSearch.trim());
    if (role) nextParams.set('pageRole', role);
    setParams(nextParams);
  };
  const field = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const reset = () => { setFilters(filtersFromQuery({ page: 0, size: 20 })); setErrors({}); setPageSearch(''); setRole(''); setDatesOpen(false); setParams({}); };
  return <AppShell user={{ fullName: user!.fullName, role: 'CLUB_MANAGER' }} breadcrumb={[{ label: 'Quản trị' }, { label: 'Nhật ký hệ thống' }]} searchPlaceholder="Tìm trong nhật ký…">
    <div className={styles.page}>
      <Link to={ROUTES.dashboard} className={styles.back}>← Tổng quan</Link>
      <header className={styles.heading}><div><h1 className="text-h1">Nhật ký hệ thống <span className={styles.readOnly}>Chỉ xem</span></h1><p className={styles.subtitle}>Ai đã làm gì và khi nào · hệ thống tự ghi · mới nhất trước</p></div></header>
      {businessDataMode() === 'sample' && <p className={styles.note}>Các dòng SAMPLE_SNAPSHOT mô tả dữ liệu mẫu hiện tại, không phải nhật ký thật của hệ thống.</p>}
      <AlertBanner type="info" title="Nhật ký là dữ liệu lịch sử — không thể tạo, sửa hay xóa">
        Bản ghi vẫn còn với tài khoản đã vô hiệu hóa. Hệ thống tự ghi khi người dùng thao tác. Nhật ký không bao giờ chứa mật khẩu, mã băm, token hay thông tin bí mật.
      </AlertBanner>
        <form className={styles.filters} onSubmit={apply} noValidate>
          <TextField className={`${styles.compactField} ${styles.searchField}`} label="Tìm trên trang này" title="Tìm người thực hiện, thao tác hoặc mã — chỉ trên trang hiện tại" type="search" placeholder="Tìm trên trang này…" value={pageSearch} onChange={(event) => setPageSearch(event.target.value)} />
          <TextField className={`${styles.compactField} ${styles.actorField}`} label="Mã người thực hiện" title="Mã người thực hiện · mọi bản ghi" inputMode="numeric" placeholder="Người thực hiện: tất cả" value={filters.actor} error={errors.actor} onChange={(event) => field('actor', event.target.value)} />
          <SelectField className={`${styles.compactField} ${styles.roleField}`} label="Vai trò trên trang này" title="Lọc vai trò chỉ áp dụng cho trang hiện tại" placeholder="Vai trò: tất cả · trang" value={role} options={ROLE_CODES.map((value) => ({ value, label: ROLE_LABELS[value] }))} onChange={(event) => setRole(event.target.value)} />
          <SelectField className={`${styles.compactField} ${styles.codeField}`} label="Thao tác" title="Thao tác · mọi bản ghi" placeholder="Thao tác: tất cả" value={filters.action} error={errors.action} options={auditActionOptions(filters.action)} onChange={(event) => field('action', event.target.value)} />
          <SelectField className={`${styles.compactField} ${styles.codeField}`} label="Loại đối tượng" title="Loại đối tượng · mọi bản ghi" placeholder="Đối tượng: tất cả" value={filters.targetType} error={errors.targetType} options={auditTargetOptions(filters.targetType)} onChange={(event) => field('targetType', event.target.value)} />
          <details className={styles.dateFilter} open={datesOpen} onToggle={(event) => setDatesOpen(event.currentTarget.open)} onKeyDown={(event) => { if (event.key === 'Escape') { setDatesOpen(false); event.currentTarget.querySelector('summary')?.focus(); } }}>
            <summary>Ngày: {filters.from || filters.to ? `${filters.from.slice(0, 10) || 'Không giới hạn đầu'} – ${filters.to.slice(0, 10) || 'Không giới hạn cuối'}` : 'Tất cả'}</summary>
            <div className={styles.datePopover}>
              <TextField label="Từ (giờ địa phương)" type="datetime-local" value={filters.from} error={errors.from} onInput={(event) => field('from', event.currentTarget.value)} onChange={(event) => field('from', event.target.value)} />
              <TextField label="Đến (giờ địa phương)" type="datetime-local" value={filters.to} error={errors.to} onInput={(event) => field('to', event.currentTarget.value)} onChange={(event) => field('to', event.target.value)} />
              <p className={styles.note}>Nhập theo giờ địa phương. Hệ thống tự đổi sang UTC khi áp dụng bộ lọc.</p>
              <Button variant="secondary" size="sm" onClick={() => setDatesOpen(false)}>Đóng bộ lọc ngày</Button>
            </div>
          </details>
          <div className={styles.filterActions}><Button type="submit" size="sm">Áp dụng bộ lọc</Button><Button variant="secondary" type="button" size="sm" onClick={reset}>Xóa bộ lọc</Button></div>
          <p className={styles.filterNote}>Bộ lọc người thực hiện, thao tác, đối tượng và ngày tìm trên mọi bản ghi. Ô tìm kiếm và lọc vai trò chỉ áp dụng cho trang hiện tại. Ngày nhập theo giờ địa phương và được gửi dưới dạng UTC.</p>
        </form>
      {(errors.page || queryErrors.page) && <ErrorState title="Trang không hợp lệ" description={errors.page ?? queryErrors.page} />}
      {(errors.size || queryErrors.size) && <ErrorState title="Số bản ghi mỗi trang không hợp lệ" description={errors.size ?? queryErrors.size} />}
      {!Object.keys(queryErrors).length && <AuditResults query={query} pageSearch={pageSearch} role={role} />}
      <p className={styles.note}>Danh sách thao tác do hệ thống máy chủ quản lý. Màn hình này không tạo hay sửa bản ghi.</p>
    </div>
  </AppShell>;
}

function AuditRouteContent() {
  const [params] = useSearchParams();
  // URL-backed server filters survive reload/back. Remounting clears old page data before loading new filters.
  return <AuditContent key={params.toString()} query={readAuditQuery(params)} />;
}

export function AuditLogPage() { return <ManagementAccess><AuditRouteContent /></ManagementAccess>; }
