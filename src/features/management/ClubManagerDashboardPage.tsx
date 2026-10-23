import { useContext, useState } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '../../app/routePaths';
import { Card, EmptyState, ErrorState, LoadingState, MetricCard, StatusBadge, type StatusOf } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { RecentAudit } from './RecentAudit';
import { ManagementShortcuts } from './ManagementShortcuts';
import { ManagementAccess } from './ManagementAccess';
import { ManagementContext, ManagementDestinationsContext } from './ManagementProvider';
import { useManagementResource } from './useManagementResource';
import type { CountByKey } from './types';
import styles from './Management.module.css';
import { businessDataMode } from '../../shared/data/businessData';

const total = (rows: CountByKey[]) => rows.reduce((sum, row) => sum + row.count, 0);
const count = (rows: CountByKey[], key: string) => rows.find((row) => row.key === key)?.count ?? 0;
const label = (key: string) => key.replaceAll('_', ' ').toLowerCase();
// Existing CM-guarded route in the FE integration harness; do not add shared routes here.
const pendingActivationPath = `${ROUTES.horses}/pending-activation`;

function Breakdown({ rows, empty, family }: { rows: CountByKey[]; empty: string; family?: 'lifecycle' | 'availability' }) {
  const sum = total(rows);
  if (!sum) return <EmptyState title={empty} />;
  return <div className={styles.breakdown}>
    <div className={styles.bar} aria-hidden="true">{rows.filter((row) => row.count > 0).map((row) => <span key={row.key} data-tone={family ? row.key : undefined} style={{ flex: row.count }} />)}</div>
    <dl className={family ? styles.legend : styles.stats}>{rows.map((row) => <div key={row.key}><dt>{family === 'lifecycle' && ['DRAFT', 'ACTIVE', 'INACTIVE'].includes(row.key) ? <StatusBadge family="lifecycle" status={row.key as StatusOf<'lifecycle'>} /> : family === 'availability' && ['AVAILABLE', 'LIMITED', 'LOCKED'].includes(row.key) ? <StatusBadge family="availability" status={row.key as StatusOf<'availability'>} /> : label(row.key)}</dt><dd>{row.count.toLocaleString('vi-VN')}</dd></div>)}</dl>
  </div>;
}

function DashboardContent() {
  const auth = useAuth();
  const destinations = useContext(ManagementDestinationsContext);
  const [localTime] = useState(() => new Date());
  const service = useContext(ManagementContext);
  const [revision, setRevision] = useState(0);
  const resource = useManagementResource(service.dashboard, revision);
  const data = resource.status === 'ready' ? resource.data : null;
  return <AppShell designSystem="v2" user={{ fullName: auth.user!.fullName, role: 'CLUB_MANAGER' }} breadcrumb={[{ label: 'Tổng quan' }, { label: 'Tổng quan câu lạc bộ' }]} searchPlaceholder="Tìm ngựa, người dùng…">
    <div className={styles.page}>
      <header className={styles.heading}>
        <div className={styles.title}><h1 className="text-h1">Tổng quan Club Manager</h1><p className={styles.subtitle}>Tổng quan quản lý · <time dateTime={localTime.toISOString()} title="Giờ hiện tại của máy, không phải thời điểm cập nhật dữ liệu">{new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(localTime)}</time> · tóm tắt từ từng phân hệ — mở phân hệ để thay đổi</p></div>
        <div className={styles.actions}><Link className={styles.linkButton} to={ROUTES.auditLog}>Xem nhật ký hệ thống</Link>{destinations.registerHorse === '/horses/new' && <Link className={`${styles.linkButton} ${styles.primaryLink}`} to={destinations.registerHorse}>+ Thêm ngựa</Link>}</div>
      </header>
      {businessDataMode() === 'sample' && <p className={styles.note}>Tổng quan mẫu dùng dữ liệu ngựa, buổi tập và sự cố dùng chung. Tài khoản đại diện cho bảy vai trò mẫu; chưa mô phỏng đăng ký. Các mục gần đây là dữ liệu mẫu, không phải nhật ký thật.</p>}
      {resource.status === 'loading' && <LoadingState label="Đang tải tổng quan quản lý…" />}
      {resource.status === 'error' && <ErrorState title={resource.forbidden ? 'Không có quyền truy cập' : 'Không tải được trang tổng quan'} description={resource.message} onRetry={resource.forbidden ? undefined : () => setRevision((value) => value + 1)} />}
      {data && <>
        <div className={styles.metrics}>
          <Link className={styles.metricLink} to={ROUTES.horses} aria-label="Xem danh sách ngựa"><MetricCard label="Ngựa" value={total(data.horsesByLifecycle).toLocaleString('vi-VN')} caption={`${count(data.horsesByLifecycle, 'ACTIVE')} hoạt động · ${count(data.horsesByLifecycle, 'DRAFT')} nháp · ${count(data.horsesByLifecycle, 'INACTIVE')} ngừng hoạt động`} /></Link>
          <Link className={styles.metricLink} to={pendingActivationPath} aria-label="Xem ngựa chờ kích hoạt"><MetricCard label="Chờ kích hoạt" value={String(data.needsAttention.pendingActivations)} caption="Ngựa nháp đang chờ kích hoạt" /></Link>
          <MetricCard label="Tình trạng ô chuồng" value={`${data.boxOccupancy.occupied} / ${data.boxOccupancy.total}`} caption={`${data.boxOccupancy.free} ô trống`} />
          <MetricCard label="Tài khoản nhân sự & người dùng" value={total(data.accountsByStatus).toLocaleString('vi-VN')} caption={`${count(data.accountsByStatus, 'ACTIVE')} đang hoạt động · ${count(data.accountsByStatus, 'INACTIVE')} ngừng hoạt động`} />
        </div>
        <div className={styles.twoColumns}>
          <Card title="Ngựa theo trạng thái" className={styles.figmaCard}>
            <div className={styles.statusGroup}><h4 className={styles.overline}>Vòng đời</h4><Breakdown rows={data.horsesByLifecycle} family="lifecycle" empty="Chưa có ngựa nào được đăng ký" /></div>
            <div className={styles.statusGroup}><h4 className={styles.overline}>Khả năng tập luyện (do Veterinarian đặt — chỉ xem ở đây)</h4><Breakdown rows={data.horsesByAvailability} family="availability" empty="Chưa có ngựa đang hoạt động" /></div>
            <p className={styles.note}>Số liệu tính trên {total(data.horsesByLifecycle)} con ngựa của câu lạc bộ. Tình trạng sức khỏe và khả năng tập luyện luôn hiển thị tách biệt với vòng đời. Khả năng tập luyện chỉ tính ngựa đang hoạt động.</p>
          </Card>
          <Card title="Cần chú ý" className={styles.figmaCard}>
            <dl className={styles.stats}>
              <div><dt><Link to={pendingActivationPath}>Ngựa chờ kích hoạt</Link></dt><dd>{data.needsAttention.pendingActivations}</dd></div>
              <div><dt>Yêu cầu đăng ký chờ duyệt</dt><dd>{data.needsAttention.pendingRegistrations}</dd></div>
              <div><dt><Link to={ROUTES.incidents}>Sự cố chưa xử lý xong</Link></dt><dd>{data.openIncidents}</dd></div>
            </dl>
            {data.needsAttention.pendingActivations + data.needsAttention.pendingRegistrations + data.openIncidents === 0 && <EmptyState title="Không có mục nào cần chú ý" />}
            <p className={styles.note}>Sự cố chưa xong gồm sự cố mới báo và đang xem xét.</p>
          </Card>
        </div>
        <div className={styles.threeColumns}>
          <Card title="Lịch tập hôm nay" className={styles.figmaCard}><p className={styles.number}>{total(data.trainingToday.byStatus)} <span className={styles.note}>{total(data.trainingToday.byStatus) === 1 ? 'buổi tập đã lên lịch' : 'buổi tập đã lên lịch'}</span></p><Breakdown rows={data.trainingToday.byStatus} empty="Hôm nay không có buổi tập nào" /></Card>
          <Card title="Sự cố" className={styles.figmaCard} action={<Link to={ROUTES.incidents}>Xem sự cố →</Link>}><p className={styles.number}>{data.openIncidents}</p><p className={styles.subtitle}>Mới báo hoặc đang xem xét</p><p className={styles.note}>Chỉ là tóm tắt quản lý.</p></Card>
          <Card title="Ô chuồng" className={styles.figmaCard}><dl className={styles.stats}><div><dt>Tổng số ô</dt><dd>{data.boxOccupancy.total}</dd></div><div><dt>Đang có ngựa</dt><dd>{data.boxOccupancy.occupied}</dd></div><div><dt>Còn trống</dt><dd>{data.boxOccupancy.free}</dd></div></dl></Card>
        </div>
        <div className={styles.auditAndShortcuts}>
          <Card title="Hoạt động gần đây" className={styles.figmaCard} action={<Link to={ROUTES.auditLog}>Xem nhật ký hệ thống →</Link>}>
            <RecentAudit entries={data.recentAudit} />
            <p className={styles.note}>Hệ thống tự ghi · chỉ xem</p>
          </Card>
          <ManagementShortcuts />
        </div>
      </>}
    </div>
  </AppShell>;
}

export function ClubManagerDashboardPage() { return <ManagementAccess><DashboardContent /></ManagementAccess>; }
