import { useCallback } from 'react';
import { AppShell } from '../layout/AppShell';
import { Button, ButtonLink, Card, DataTable, EmptyState, ErrorState, Icon, LoadingState, MetricCard, StatusBadge, type IconName } from '../design-system';
import { ROUTES } from '../app/routePaths';
import { useAuth } from '../shared/auth/AuthProvider';
import { ROLE_LABELS, type RoleCode } from '../shared/auth/roles';
import { NAVIGATION } from '../layout/navigation';
import { useFlowRequest } from '../features/main-flows/api';
import { useResource } from '../features/main-flows/useResource';
import type { HorseDetail, Page } from '../features/horses/api/types';
import styles from './WorkspacePage.module.css';

type WorkspaceAction = { title: string; description: string; label: string; to: string; icon: IconName };
const WORKSPACES: Record<RoleCode, { description: string; primary: WorkspaceAction; actions: WorkspaceAction[] }> = {
  VETERINARIAN: {
    description: 'Xem ngựa mới đến, theo dõi ca y tế và quản lý sức khỏe đàn ngựa.',
    primary: { title: 'Ca y tế', description: '', label: 'Mở ca y tế', to: ROUTES.medical, icon: 'stethoscope' },
    actions: [
      { title: 'Hồ sơ ngựa & khám ban đầu', description: 'Chọn ngựa, xem hồ sơ và ghi kết quả khám sức khỏe ban đầu.', label: 'Xem danh sách ngựa', to: ROUTES.horses, icon: 'horseshoe' },
      { title: 'Ca y tế', description: 'Mở các lần khám, hạn chế, phác đồ điều trị và hồ sơ hồi phục.', label: 'Xem ca y tế', to: ROUTES.medical, icon: 'stethoscope' },
      { title: 'Sức khỏe đàn ngựa', description: 'Xem tổng quan sức khỏe đàn ngựa và nhận biết ngựa cần chú ý.', label: 'Xem sức khỏe đàn ngựa', to: ROUTES.herdHealth, icon: 'activity' },
      { title: 'Xem xét sự cố', description: 'Xem các quan sát đã báo và tiếp tục xử lý y tế.', label: 'Xem xét sự cố', to: ROUTES.incidents, icon: 'shield-alert' },
    ],
  },
  HEAD_TRAINER: {
    description: 'Xem mức sẵn sàng của ngựa, chọn chiến lược dùng lại được và phân công Trainer phù hợp.',
    primary: { title: 'Tạo chương trình', description: '', label: 'Tạo chương trình', to: ROUTES.trainingProgramCreate, icon: 'plus' },
    actions: [
      { title: 'Mức sẵn sàng của ngựa', description: 'Xem hồ sơ, sức khỏe ban đầu và khả năng tập luyện trước khi lên kế hoạch huấn luyện.', label: 'Xem ngựa', to: ROUTES.horses, icon: 'horseshoe' },
      { title: 'Mẫu chương trình', description: 'So sánh các chiến lược dùng lại được và các phiên bản đã lưu.', label: 'Xem mẫu chương trình', to: ROUTES.programTemplates, icon: 'book-open' },
      { title: 'Chương trình huấn luyện ngựa', description: 'Mở chương trình của ngựa, phiên bản mẫu đã chọn và phân công Trainer.', label: 'Xem chương trình', to: ROUTES.trainingPrograms, icon: 'clipboard-list' },
      { title: 'Lịch tập', description: 'Xem các buổi tập đã lên lịch của câu lạc bộ.', label: 'Xem lịch tập', to: ROUTES.trainingSchedule, icon: 'calendar' },
    ],
  },
  GROOM: {
    description: 'Các mục kiểm tra trước buổi tập và công việc chăm sóc được giao cho bạn.',
    primary: { title: 'Hôm nay', description: '', label: 'Mở hôm nay & kiểm tra', to: ROUTES.groomToday, icon: 'clipboard-list' },
    actions: [
      { title: 'Hôm nay & kiểm tra', description: 'Tìm ngựa được giao và hoàn tất cả năm mục kiểm tra trước buổi tập.', label: 'Mở kiểm tra trước buổi tập', to: ROUTES.groomToday, icon: 'clipboard-list' },
      { title: 'Công việc điều trị', description: 'Làm theo hướng dẫn của Veterinarian và ghi nhận công việc chăm sóc đã làm.', label: 'Xem công việc điều trị', to: ROUTES.careTasks, icon: 'check-circle' },
      { title: 'Sự cố đã báo', description: 'Theo dõi trạng thái xử lý các quan sát bạn đã báo.', label: 'Xem sự cố', to: ROUTES.incidents, icon: 'alert-triangle' },
    ],
  },
  WORK_RIDER: {
    description: 'Xem lượt cưỡi được giao, kiểm tra mức sẵn sàng và làm theo hướng dẫn của Trainer.',
    primary: { title: 'Lịch phân công', description: '', label: 'Mở lịch phân công', to: ROUTES.assignments, icon: 'play' },
    actions: [
      { title: 'Lượt cưỡi hôm nay', description: 'Mở buổi tập hôm nay và xem kế hoạch bài tập được giao.', label: 'Xem lượt cưỡi hôm nay', to: ROUTES.myRides, icon: 'calendar' },
      { title: 'Lịch phân công của tôi', description: 'Xem các mục sẵn sàng và chỉ bắt đầu khi mọi điều kiện đều đạt.', label: 'Xem lịch phân công', to: ROUTES.assignments, icon: 'clipboard-list' },
      { title: 'Lịch sử cưỡi', description: 'Xem lại các lượt cưỡi đã hoàn thành và phản hồi đã gửi.', label: 'Xem lịch sử cưỡi', to: ROUTES.ridingHistory, icon: 'history' },
    ],
  },
  HORSE_OWNER: {
    description: 'Ngựa của bạn, sức khỏe và việc huấn luyện — trong một cổng thông tin chỉ xem.',
    primary: { title: 'Ngựa của tôi', description: '', label: 'Mở ngựa của tôi', to: ROUTES.myHorses, icon: 'horseshoe' },
    actions: [
      { title: 'Ngựa của tôi', description: 'Xem hồ sơ, phả hệ, chuồng, tóm tắt sức khỏe và huấn luyện của ngựa.', label: 'Xem ngựa của tôi', to: ROUTES.myHorses, icon: 'horseshoe' },
      { title: 'Thông báo', description: 'Mở các cập nhật dành cho tài khoản của bạn.', label: 'Xem thông báo', to: ROUTES.notifications, icon: 'bell' },
    ],
  },
  CLUB_MANAGER: {
    description: 'Quản lý đăng ký ngựa và xem danh sách ngựa của câu lạc bộ.',
    primary: { title: 'Thêm ngựa', description: '', label: 'Thêm ngựa', to: '/horses/new', icon: 'plus' },
    actions: [
      { title: 'Danh sách ngựa', description: 'Xem các ngựa đã đăng ký và hồ sơ hiện tại.', label: 'Xem danh sách ngựa', to: ROUTES.horses, icon: 'horseshoe' },
      { title: 'Chờ kích hoạt', description: 'Hoàn tất các yêu cầu cho ngựa mới đăng ký.', label: 'Xem ngựa chờ kích hoạt', to: ROUTES.pendingActivation, icon: 'clipboard-list' },
    ],
  },
  TRAINER: {
    description: 'Mở chương trình được giao, lên kế hoạch buổi tập và xem kết quả.',
    primary: { title: 'Chương trình được giao', description: '', label: 'Mở chương trình được giao', to: ROUTES.assignedPrograms, icon: 'clipboard-list' },
    actions: [
      { title: 'Chương trình được giao', description: 'Xem các chương trình riêng cho từng ngựa được giao cho bạn.', label: 'Xem chương trình được giao', to: ROUTES.assignedPrograms, icon: 'clipboard-list' },
      { title: 'Lịch tập', description: 'Lên kế hoạch buổi tập trong giới hạn chương trình và y tế đã duyệt.', label: 'Xem lịch', to: ROUTES.trainingCalendar, icon: 'calendar' },
      { title: 'Thành tích', description: 'Xem kết quả và đánh giá buổi tập.', label: 'Xem thành tích', to: ROUTES.performance, icon: 'bar-chart' },
    ],
  },
};

export function WorkspacePage() {
  const { user } = useAuth();
  if (!user) return null;
  const role = user.roles[0], workspace = WORKSPACES[role];
  return <AppShell designSystem="v2" user={{ fullName: user.fullName, role }} breadcrumb={[{ label: 'Tổng quan' }]}>
    <div className={styles.page}>
      <header className={styles.heading}>
        <div><p className={styles.eyebrow}>KHÔNG GIAN CỦA BẠN</p><h1 className="text-h1">{NAVIGATION[role].workspaceLabel}</h1><p className={styles.description}>{workspace.description}</p></div>
        <ButtonLink variant="primary" to={workspace.primary.to}><Icon name={workspace.primary.icon} size={18} />{workspace.primary.label}</ButtonLink>
      </header>
      <section className={styles.welcome} aria-label="Tổng quan không gian làm việc">
        <div className={styles.welcomeIcon}><Icon name={workspace.primary.icon} size={28} /></div>
        <div><span className={styles.eyebrow}>{ROLE_LABELS[role]}</span><h2>Xin chào, {user.fullName}</h2><p>Chọn một công việc bên dưới để tiếp tục.</p></div>
        <span className={styles.access}><Icon name="shield-check" size={16} />Truy cập theo vai trò</span>
      </section>
      <section aria-labelledby="workspace-actions-title" className={styles.section}>
        <div className={styles.sectionHeading}><h2 id="workspace-actions-title">Thao tác nhanh</h2><span>Mở không gian làm việc</span></div>
        <div className={styles.actionGrid}>{workspace.actions.map((action) => <Card key={action.to} className={styles.actionCard}>
          <span className={styles.actionIcon}><Icon name={action.icon} size={24} /></span><h3>{action.title}</h3><p>{action.description}</p>
          <ButtonLink to={action.to}>{action.label}<Icon name="chevron-right" size={16} /></ButtonLink>
        </Card>)}</div>
      </section>
      {role === 'VETERINARIAN' && <VeterinaryArrivals />}
      <footer className={styles.identity}><span><Icon name="user" size={16} />{user.email}</span><span>{ROLE_LABELS[role]} · {user.userCode}</span><ButtonLink variant="tertiary" to={ROUTES.account}>Xem tài khoản</ButtonLink></footer>
    </div>
  </AppShell>;
}

function VeterinaryArrivals() {
  const request = useFlowRequest();
  const load = useCallback((signal: AbortSignal) => request<Page<HorseDetail>>('/api/horses?lifecycle=DRAFT&page=0&size=6', { signal }), [request]);
  const resource = useResource(load), data = resource.data;
  return <section className={styles.section} aria-labelledby="arrivals-title">
    <div className={styles.sectionHeading}><div><h2 id="arrivals-title">Ngựa mới đến</h2><p>Ngựa nháp trong danh sách của câu lạc bộ. Mở hồ sơ để xem các yêu cầu tiếp nhận.</p></div><Button variant="secondary" onClick={resource.reload}><Icon name="history" size={16} />Làm mới</Button></div>
    {resource.pending && <LoadingState label="Đang tải ngựa mới đến…" />}
    {resource.error && <ErrorState title="Không tải được ngựa mới đến" description={resource.error} onRetry={resource.reload} />}
    {data && <><div className={styles.metrics}><MetricCard label="Ngựa nháp" value={String(data.totalItems)} caption="Trong danh sách câu lạc bộ" /><MetricCard label="Hiển thị ở đây" value={String(data.items.length)} caption="Sáu hồ sơ nháp mới nhất" /></div>
      <Card><div className={styles.table} role="region" aria-label="Ngựa mới đến" tabIndex={0}><DataTable<HorseDetail> caption="Ngựa mới đến" rows={data.items} rowKey={(horse) => horse.id} empty={<EmptyState title="Không có ngựa nháp" description="Ngựa mới đăng ký sẽ hiện ở đây khi Club Manager lưu." />} columns={[
        { key: 'horse', header: 'Ngựa', render: (horse) => <div className={styles.horseName}><strong>{horse.name}</strong><span>{horse.horseCode}</span></div> },
        { key: 'box', header: 'Chuồng', render: (horse) => horse.currentBoxCode ?? 'Chưa phân công' },
        { key: 'status', header: 'Trạng thái', render: (horse) => <StatusBadge family="lifecycle" status={horse.lifecycle} /> },
        { key: 'health', header: 'Sức khỏe', render: (horse) => horse.healthStatus ? <StatusBadge family="health" status={horse.healthStatus} /> : 'Chưa ghi nhận' },
        { key: 'actions', header: 'Thao tác', render: (horse) => <div className={styles.rowActions}><ButtonLink size="sm" to={`/horses/${horse.id}`}>Xem hồ sơ</ButtonLink>{!horse.healthStatus && <ButtonLink size="sm" to={`/horses/${horse.id}/baseline`}>Ghi khám ban đầu</ButtonLink>}</div> },
      ]} /></div></Card></>}
  </section>;
}
