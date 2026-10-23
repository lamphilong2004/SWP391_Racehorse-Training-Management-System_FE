import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { RequireAuth } from '../../app/RequireAuth';
import { ROUTES } from '../../app/routePaths';
import { ButtonLink, AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, KeyValue, LoadingState, Modal, SelectField, TextAreaField } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { PageHeader } from '../../layout/PageHeader';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import { authSession } from '../../shared/auth/authSession';
import { isRoleCode, ROLE_CODES, ROLE_LABELS, type RoleCode } from '../../shared/auth/roles';
import { RegistrationContext } from './RegistrationProvider';
import { REGISTRATION_STATUSES, STATUS_LABELS, type RegistrationPage, type RegistrationQuery, type RegistrationRequest } from './types';
import { queryFromParams, validateQuery } from './validation';
import styles from './registration.module.css';

const time = (iso: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
type Decision = { request: RegistrationRequest; kind: 'approve' | 'reject' };

export function RegistrationReviewPage() { return <RequireAuth><ReviewAccess /></RequireAuth>; }
function ReviewAccess() {
  const { user } = useAuth();
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.includes('CLUB_MANAGER')) return <main className="auth-problem"><ErrorState title="Không có quyền truy cập" description="Chỉ Club Manager được duyệt đăng ký." /><ButtonLink variant="tertiary" to={ROUTES.dashboard}>← Quay lại không gian làm việc</ButtonLink></main>;
  return <ReviewContent key={user.id} />;
}
function ReviewContent() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => queryFromParams(params), [params]);
  const queryError = validateQuery(query);
  const [revision, setRevision] = useState(0);
  const change = (name: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(name, value); else next.delete(name); if (name !== 'page') next.set('page', '0'); setParams(next); };
  return <AppShell user={{ fullName: user!.fullName, role: 'CLUB_MANAGER' }} breadcrumb={[{ label: 'Quản trị' }, { label: 'Duyệt yêu cầu đăng ký' }]}>
    <div className={styles.stack}>
      <Link className={styles.back} to={ROUTES.dashboard}>← Quay lại không gian làm việc</Link>
      <PageHeader title="Duyệt yêu cầu đăng ký" description="Xem xét yêu cầu truy cập và cấp đúng một vai trò khi duyệt." actions={<Button variant="secondary" onClick={() => setRevision((value) => value + 1)}>Làm mới danh sách</Button>} />
      <AlertBanner type="info" title="Cần Club Manager phê duyệt">Người đăng ký không tự chọn vai trò. Duyệt sẽ tạo tài khoản đang hoạt động; từ chối vẫn giữ lại yêu cầu. Người đăng ký không nhận email hay thông báo.</AlertBanner>
      <div className={styles.filters}>
        <SelectField label="Trạng thái" placeholder="Tất cả trạng thái" value={query.status ?? ''} options={REGISTRATION_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))} onChange={(event) => change('status', event.target.value)} />
        <SelectField label="Số yêu cầu mỗi trang" value={String(query.size)} options={[...new Set([10, 20, 50, 100, ...(query.size >= 1 && query.size <= 100 ? [query.size] : [])])].map((value) => ({ value: String(value), label: String(value) }))} onChange={(event) => change('size', event.target.value)} />
        <Button variant="secondary" onClick={() => setParams({})}>Xóa bộ lọc</Button>
      </div>
      {queryError ? <ErrorState title="Bộ lọc đăng ký không hợp lệ" description={queryError} /> : <ReviewResults key={params.toString()} query={query} revision={revision} onRefresh={() => setRevision((value) => value + 1)} onPage={(value) => change('page', String(value))} />}
    </div>
  </AppShell>;
}

function ReviewResults({ query, revision, onRefresh, onPage }: { query: RegistrationQuery; revision: number; onRefresh: () => void; onPage: (value: number) => void }) {
  const service = useContext(RegistrationContext);
  const { handleApiError } = useAuth();
  const token = authSession.read()?.accessToken ?? '';
  const [result, setResult] = useState<{ source?: object; data?: RegistrationPage; error?: string; forbidden?: boolean }>({});
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notice, setNotice] = useState('');
  const source = useMemo(() => ({ service, query, token, revision }), [service, query, token, revision]);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    service.list(source.query, { token: source.token, signal: controller.signal }).then((data) => { if (active) setResult({ source, data }); }).catch((cause: unknown) => {
      if (!active || handleApiError(cause)) return;
      setResult({ source, error: cause instanceof Error ? cause.message : 'Không tải được yêu cầu đăng ký.', forbidden: cause instanceof ApiError && cause.status === 403 });
    });
    return () => { active = false; controller.abort(); };
  }, [source, service, handleApiError]);
  const current = result.source === source ? result : {};
  const data = current.data;
  const approved = useCallback((request: RegistrationRequest) => { setDecision(null); setNotice(`Đã ${request.status === 'APPROVED' ? 'duyệt' : 'từ chối'} yêu cầu ${request.id}.`); onRefresh(); }, [onRefresh]);
  return <>
    {notice && <AlertBanner type="success" title={notice} />}
    {!data ? current.error ? <ErrorState title={current.forbidden ? 'Không có quyền truy cập' : 'Không tải được yêu cầu đăng ký'} description={current.error} onRetry={current.forbidden ? undefined : onRefresh} /> : <LoadingState label="Đang tải yêu cầu đăng ký…" /> : <Card title="Yêu cầu truy cập">
      <div className={styles.tableScroll}><DataTable<RegistrationRequest> caption="Yêu cầu đăng ký" rows={data.items} rowKey={(row) => row.id} empty={<EmptyState title="Không có yêu cầu đăng ký" description="Không có yêu cầu phù hợp với trạng thái và trang này." />} columns={[
        { key: 'applicant', header: 'Người đăng ký', render: (row) => <div><strong>{row.fullName}</strong><span className={styles.secondary}>{row.email}</span></div> },
        { key: 'requested', header: 'Đề xuất', render: (row) => <time dateTime={row.requestedAt} title={row.requestedAt}>{time(row.requestedAt)}</time> },
        { key: 'status', header: 'Trạng thái', render: (row) => STATUS_LABELS[row.status] },
        { key: 'decision', header: 'Quyết định', render: (row) => row.status === 'PENDING_APPROVAL' ? 'Chờ xem xét' : <div>{row.approvedRoleCode && <span>{ROLE_LABELS[row.approvedRoleCode]}</span>}{row.reviewedBy && <span className={styles.secondary}>Bởi {row.reviewedBy.fullName}</span>}{row.reviewedAt && <time className={styles.secondary} dateTime={row.reviewedAt} title={row.reviewedAt}>{time(row.reviewedAt)}</time>}{row.decisionReason && <span className={styles.secondary}>{row.decisionReason}</span>}</div> },
        { key: 'actions', header: 'Thao tác', render: (row) => row.status === 'PENDING_APPROVAL' ? <div className={styles.actions}><Button size="sm" variant="secondary" aria-label={`Duyệt yêu cầu ${row.id}`} onClick={() => setDecision({ request: row, kind: 'approve' })}>Duyệt</Button><Button size="sm" variant="tertiary" aria-label={`Từ chối yêu cầu ${row.id}`} onClick={() => setDecision({ request: row, kind: 'reject' })}>Từ chối</Button></div> : 'Đã đánh giá' },
      ]} /></div>
      <footer className={styles.pagination}>
        <span aria-live="polite">{data.items.length ? `Hiển thị ${data.page * data.size + 1}–${data.page * data.size + data.items.length} trên ${data.totalItems}` : `Tổng ${data.totalItems} yêu cầu`} · Trang {data.page + 1}/{Math.max(1, data.totalPages)}</span>
        <div className={styles.actions}>{!data.items.length && data.page > 0 && <Button variant="secondary" onClick={() => onPage(0)}>Trang đầu</Button>}<Button variant="secondary" disabled={data.page === 0} onClick={() => onPage(data.page - 1)}>Trước</Button><Button variant="secondary" disabled={data.page + 1 >= data.totalPages} onClick={() => onPage(data.page + 1)}>Sau</Button></div>
      </footer>
    </Card>}
    {decision && <DecisionDialog key={`${decision.request.id}:${decision.kind}`} decision={decision} onClose={() => setDecision(null)} onSuccess={approved} onRefresh={() => { setDecision(null); onRefresh(); }} />}
  </>;
}

function DecisionDialog({ decision, onClose, onSuccess, onRefresh }: { decision: Decision; onClose: () => void; onSuccess: (value: RegistrationRequest) => void; onRefresh: () => void }) {
  const service = useContext(RegistrationContext); const auth = useAuth();
  const [role, setRole] = useState(''); const [reason, setReason] = useState(''); const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false); const [pending, setPending] = useState(false); const busy = useRef(false); const formId = useId();
  const approving = decision.kind === 'approve';
  return <Modal open title={`${approving ? 'Duyệt' : 'Từ chối'} request ${decision.request.id}`} onClose={() => { if (!busy.current) onClose(); }} footer={<><Button variant="secondary" disabled={pending} onClick={onClose}>Hủy</Button><Button type="submit" form={formId} disabled={pending || conflict}>{pending ? 'Đang lưu quyết định…' : approving ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}</Button></>}>
    <form id={formId} className={styles.stack} noValidate aria-busy={pending} onSubmit={async (event) => {
      event.preventDefault(); if (busy.current || conflict) return;
      setError('');
      if (approving && !isRoleCode(role)) { setError('Hãy chọn đúng một vai trò trước khi duyệt.'); return; }
      if (!approving && reason.length > 500) { setError('Lý do tối đa 500 ký tự.'); return; }
      busy.current = true; setPending(true);
      try {
        const context = { token: authSession.read()?.accessToken ?? '' };
        const updated = approving ? await service.approve(decision.request.id, role as RoleCode, context) : await service.reject(decision.request.id, reason, context);
        onSuccess(updated);
      } catch (cause) {
        if (!auth.handleApiError(cause)) {
          const stale = cause instanceof ApiError && [404, 409].includes(cause.status); setConflict(stale);
          setError(stale ? 'Không xử lý được yêu cầu này. Hãy làm mới danh sách rồi quyết định lại.' : cause instanceof Error ? cause.message : 'Không lưu được quyết định.');
        }
      } finally { busy.current = false; setPending(false); }
    }}>
      <KeyValue label="Người đăng ký" value={decision.request.fullName} /><KeyValue label="Email" value={decision.request.email} />
      {approving ? <><SelectField label="Vai trò được cấp" placeholder="Chọn một vai trò" required value={role} disabled={pending} options={ROLE_CODES.map((value) => ({ value, label: ROLE_LABELS[value] }))} onChange={(event) => setRole(event.target.value)} /><p className={styles.note}>Duyệt sẽ tạo tài khoản đang hoạt động với vai trò này. Người đăng ký đăng nhập bằng mật khẩu đã đặt khi đăng ký.</p></> : <TextAreaField label="Lý do từ chối (không bắt buộc)" maxLength={500} value={reason} disabled={pending} onChange={(event) => setReason(event.target.value)} helperText="Chỉ Club Manager xem được. Người đăng ký không được thông báo." />}
      {error && <AlertBanner type="danger" title="Chưa lưu được quyết định">{error}{conflict && <Button variant="secondary" onClick={onRefresh}>Đóng và làm mới</Button>}</AlertBanner>}
    </form>
  </Modal>;
}
