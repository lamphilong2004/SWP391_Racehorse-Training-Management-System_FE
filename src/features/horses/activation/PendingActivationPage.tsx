import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AlertBanner, Button, Card, EmptyState, ErrorState, StatusBadge, Icon, LoadingState, type IconName, DesignSystemScope } from '../../../design-system';
import { useHorsesApi } from '../api/HorsesApiContext';
import type { ActivationItem, ActivationStatus, HorseDetail } from '../api/types';
import { ageInYears, formatDate } from '../shared/format';
import { sexLabel } from '../shared/options';
import { useBreadcrumb } from '../shared/HorseManagementLayout';
import shared from '../shared/horses.module.css';
import styles from './PendingActivationPage.module.css';

interface PendingHorse {
  status: ActivationStatus;
  horse: HorseDetail;
}

/** Labels and owners of the mandatory items, as drawn on Figma 285:2786. */
const ITEMS: Record<ActivationItem, { label: string; who: 'Club Manager' | 'Veterinarian'; sub: (h: HorseDetail) => string }> = {
  IDENTITY: { label: 'Hồ sơ & nhận dạng', who: 'Club Manager', sub: () => 'Club Manager · Đăng ký ngựa' },
  PEDIGREE: { label: 'Phả hệ', who: 'Club Manager', sub: () => 'Club Manager · Ngựa cha và ngựa mẹ' },
  OWNER: { label: 'Quyền sở hữu', who: 'Club Manager', sub: () => 'Club Manager · Horse Owner' },
  FREE_STABLE_BOX: {
    label: 'Đã xếp ô chuồng', who: 'Club Manager',
    sub: (h) => (h.currentBoxCode ? `Club Manager · ${h.currentBoxCode} (ô trống)` : 'Club Manager · một ô chuồng trống'),
  },
  VETERINARIAN_BASELINE: { label: 'Khám sức khỏe ban đầu', who: 'Veterinarian', sub: () => 'Veterinarian · cân nặng, thể trạng, tình trạng sức khỏe ban đầu' },
};

/**
 * SCR-HORSE-005 Pending Activation (Figma 285:2786) — Flow 1 step 1.5 status view for the Club Manager.
 * Activation is automatic (DEC-009 §1): there is NO approve or activate action anywhere on this page. The Head Trainer
 * readiness review is shown as "Recommended — does not block activation".
 */
/** Design System v2 scope for this CORE-013 screen; the shared horse layout stays owner-neutral. */
export function PendingActivationPage() {
  return <DesignSystemScope><PendingActivationPageContent /></DesignSystemScope>;
}

function PendingActivationPageContent() {
  const api = useHorsesApi();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { completedHorseId?: number } };
  useBreadcrumb([{ label: 'Ngựa', to: '/horses' }, { label: 'Chờ kích hoạt' }]);

  const [pending, setPending] = useState<PendingHorse[]>();
  const [error, setError] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [metadata, setMetadata] = useState({ totalItems: 0, totalPages: 0 });

  const fetchPending = useCallback(async () => {
    const page = await api.listPendingActivation(pageIndex);
    const horses = await Promise.all(page.items.map((status) => api.getHorse(status.horseId)));
    return { items: page.items.map((status, i) => ({ status, horse: horses[i] })), totalItems: page.totalItems, totalPages: page.totalPages };
  }, [api, pageIndex]);

  useEffect(() => {
    let active = true;
    fetchPending().then((data) => { if (active) { setPending(data.items); setMetadata(data); } }, () => active && setError(true));
    return () => {
      active = false;
    };
  }, [fetchPending]);

  const load = () => fetchPending().then((data) => { setPending(data.items); setMetadata(data); }, () => setError(true));
  const changePage = (page: number) => { setPending(undefined); setError(false); setPageIndex(page); };

  const completed = pending?.find((p) => p.horse.id === location.state?.completedHorseId);

  return (
    <div className={shared.page}>
      <button type="button" className={shared.back} onClick={() => navigate('/horses')}>{'← Quay lại danh sách ngựa'}</button>

      <div className={shared.titleBlock}>
        <h1 className={shared.title}>Chờ kích hoạt</h1>
        <p className={shared.subtitle}>
          {`Ngựa ở trạng thái Nháp và những gì còn thiếu trước khi chuyển sang Hoạt động${pending ? ` · ${metadata.totalItems} con ngựa` : ''}`}
        </p>
      </div>

      {completed && completed.horse.currentBoxCode && missingItems(completed.status).every((item) => item === 'VETERINARIAN_BASELINE') && (
        <AlertBanner type="success" title={`Đã xếp ô chuồng ${completed.horse.currentBoxCode} cho ${completed.horse.name}`}>
          {missingItems(completed.status).length === 1 && missingItems(completed.status)[0] === 'VETERINARIAN_BASELINE'
            ? 'Đã ghi phả hệ, chủ ngựa và ô chuồng. Yêu cầu còn lại là khám sức khỏe ban đầu của Veterinarian.'
            : 'Đã ghi phả hệ, chủ ngựa và ô chuồng.'}
        </AlertBanner>
      )}

      <div className={shared.twoCol}>
        <div className={shared.colMain}>
          {error && <Card><ErrorState title="Không tải được danh sách ngựa chờ kích hoạt" description="Không tải được danh sách ngựa chờ kích hoạt." onRetry={() => { setError(false); setPending(undefined); void load(); }} /></Card>}
          {!error && !pending && <Card><LoadingState label="Đang tải ngựa chờ kích hoạt…" /></Card>}
          {pending && pending.length === 0 && (
            <Card>
              <EmptyState title="Không có ngựa nào chờ kích hoạt"
                description="Không có ngựa ở trạng thái Nháp. Ngựa mới sẽ hiện ở đây khi còn thiếu yêu cầu bắt buộc." />
            </Card>
          )}
          {pending?.map((p) => <PendingHorseCard key={p.horse.id} {...p} onViewRegister={() => navigate('/horses')} />)}
          {pending && metadata.totalPages > 1 && <div className={shared.footer}><Button variant="secondary" disabled={pageIndex === 0} onClick={() => changePage(pageIndex - 1)}>Trang trước</Button><span>Trang {pageIndex + 1}/{metadata.totalPages}</span><Button variant="secondary" disabled={pageIndex + 1 >= metadata.totalPages} onClick={() => changePage(pageIndex + 1)}>Trang sau</Button></div>}
        </div>

        <aside className={shared.colSide}>
          <Card>
            <div className={styles.howBody}>
              <h2 className={shared.cardTitle}>Cách kích hoạt hoạt động</h2>
              <p className={styles.howText}>Nháp → Hoạt động diễn ra tự động khi dữ liệu ngựa hợp lệ: nhận dạng, phả hệ và chủ ngựa, một ô chuồng trống, và kết quả khám ban đầu của Veterinarian.</p>
              <p className={styles.howMuted}>Club Manager không thể ghi hay sửa kết quả khám ban đầu — đó là việc khám của Veterinarian.</p>
              <div className={styles.lifecycle}>
                <StatusBadge family="lifecycle" status="DRAFT" />
                <Icon name="chevron-right" size={16} />
                <StatusBadge family="lifecycle" status="ACTIVE" />
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function missingItems(status: ActivationStatus): ActivationItem[] {
  return status.checklist.flatMap((c) => c.requirement === 'MANDATORY' && c.state === 'PENDING' ? [c.id] : []);
}

function PendingHorseCard({ status, horse, onViewRegister }: PendingHorse & { onViewRegister: () => void }) {
  const age = ageInYears(horse.foaledDate);
  const owner = horse.currentOwnerships[0]?.owner.fullName;
  const meta = [horse.breed, sexLabel(horse.sex), age !== null ? `${age} tuổi` : null,
    owner ? `Chủ ngựa ${owner}` : null, horse.currentBoxCode ? `Ô chuồng ${horse.currentBoxCode}` : null,
    `registered ${formatDate(horse.createdAt)}`].filter(Boolean).join(' · ');
  const missing = missingItems(status);
  const onlyBaseline = missing.length === 1 && missing[0] === 'VETERINARIAN_BASELINE';
  const reviewed = status.checklist.find((c) => c.id === 'HEAD_TRAINER_READINESS_REVIEW')?.state === 'REVIEWED';

  return (
    <Card>
      <div className={styles.horseBody}>
        <div className={styles.horseHeader}>
          <div className={styles.horseName}>
            <h2 className={styles.horseTitle}>{`${horse.name} · ${horse.horseCode}`}</h2>
            <p className={styles.horseMeta}>{meta}</p>
          </div>
          <StatusBadge family="lifecycle" status={status.lifecycle} />
        </div>
        <hr className={styles.divider} />
        <h3 className={styles.checklistTitle}>Danh mục kích hoạt</h3>
        <ul className={styles.checklist}>
          {status.checklist.map((c) => {
            if (c.requirement !== 'MANDATORY') return null;
            const spec = ITEMS[c.id];
            const complete = c.state === 'SATISFIED';
            return (
              <ChecklistRow key={c.id} icon={complete ? 'check-circle' : 'clock'} tone={complete ? 'success' : 'warning'}
                label={c.label} sub={c.description} value={complete ? 'Hoàn tất' : `Đang chờ — ${spec.who}`} />
            );
          })}
          <ChecklistRow icon={reviewed ? 'check-circle' : 'circle'} tone="muted" label="Đánh giá sẵn sàng của Head Trainer"
            sub="Nên làm trước khi tập — không chặn việc kích hoạt" value={reviewed ? 'Đã đánh giá' : 'Khuyến nghị'} />
        </ul>
        <div className={[shared.note, shared.noteWarning, shared.noteStrong].join(' ')} role="status">
          <Icon name="clock" size={16} />
          <span>
            {onlyBaseline
              ? 'Đang chờ khám ban đầu của Veterinarian — yêu cầu cuối cùng.'
              : `Đang chờ: ${missing.map((m) => ITEMS[m]?.label.toLowerCase() ?? m).join(', ')}. `}
            {`${horse.name} tự chuyển sang Hoạt động khi đủ mọi yêu cầu bắt buộc — không cần duyệt thủ công.`}
          </span>
        </div>
        <div className={styles.actions}>
          {/* NEEDS CLARIFICATION: no contract operation exists for requesting the baseline (CORE-004); shown disabled. */}
          <Button variant="secondary" disabled title="Chưa hỗ trợ — hệ thống chưa có thao tác yêu cầu này">
            Yêu cầu khám ban đầu
          </Button>
          <Button variant="tertiary" onClick={onViewRegister}>Xem danh sách ngựa</Button>
        </div>
      </div>
    </Card>
  );
}

function ChecklistRow({ icon, tone, label, sub, value }: { icon: IconName; tone: 'success' | 'warning' | 'muted'; label: string; sub: string; value: string }) {
  return (
    <li className={styles.check}>
      <span className={[styles.checkIcon, styles[tone]].join(' ')}><Icon name={icon} size={18} /></span>
      <span className={styles.checkText}>
        <span className={styles.checkLabel}>{label}</span>
        <span className={styles.checkSub}>{sub}</span>
      </span>
      <span className={[styles.checkValue, styles[tone]].join(' ')}>{value}</span>
    </li>
  );
}
