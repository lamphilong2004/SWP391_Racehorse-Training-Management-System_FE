import { UiPreviewNotice } from './UiPreviewNotice';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { AlertBanner, ButtonLink, Card, EmptyState, ErrorState, Icon, LoadingState, SelectField, StatusBadge } from '../../design-system';
import { PageHeader } from '../../layout/PageHeader';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { MEDICAL_ROUTES } from './paths';
import { sexLabel } from '../horses/shared/options';
import { createSummaryService, type SummaryService } from './summaryService';
import { ApiError } from '../../shared/auth/authApi';
import './medical.css';
import { viLabel } from '../../shared/viLabels';

export function MedicalSummaryAccess() {
  const auth = useAuth(), actor = auth.user, token = authSession.read()?.accessToken;
  const service = useMemo(() => token ? createSummaryService(token, auth.handleApiError) : null, [token, auth.handleApiError]);
  if (auth.status !== 'authenticated' || !actor || actor.accountStatus !== 'ACTIVE' || !actor.roles.includes('HEAD_TRAINER') || !service)
    return <AlertBanner type="danger" title="Không có quyền truy cập" />;
  return <AppShell user={{ fullName: actor.fullName, role: 'HEAD_TRAINER' }} breadcrumb={[{ label: 'Tóm tắt y tế' }]}>
    <UiPreviewNotice />
    <MedicalSummaryPage key={`${actor.id}:${auth.expiresAt}`} service={service} />
  </AppShell>;
}
function useRead<T>(load: () => Promise<T>, key: unknown) {
  const [state, setState] = useState<{ key: unknown; data?: T; error?: string }>({ key: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    load().then((data) => { if (active) setState({ key, data }); })
      .catch((error: unknown) => { if (active) setState({ key, error: error instanceof ApiError ? error.status === 403 ? 'Không có quyền truy cập. Tài khoản này không xem được bản tóm tắt.' : 'Không tải được bản tóm tắt. Hãy thử lại.' : error instanceof Error ? error.message : 'Không tải được bản tóm tắt.' }); });
    return () => { active = false; };
  }, [load, key, revision]);
  return { ...(state.key === key ? state : {}), retry: () => { setState({ key: null }); setRevision((n) => n + 1); } };
}
function State({ error, retry }: { error?: string; retry: () => void }) {
  return error ? <ErrorState title="Không tải được bản tóm tắt" description={error} onRetry={retry} /> : <LoadingState label="Đang tải tóm tắt y tế…" />;
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="medical-summary-row"><dt>{label}</dt><dd>{children}</dd></div>;
}
/** Non-clinical, read-only Figma 274:9405. Missing DTO fields stay unavailable, never inferred. */
export function MedicalSummaryPage({ service }: { service: SummaryService }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get('horseId');
  const id = selected === null ? null : Number(selected);
  const listLoad = useMemo(() => () => service.listHorses(), [service]);
  const horses = useRead(listLoad, service);
  if (id !== null && (!/^\d+$/.test(selected!) || !Number.isSafeInteger(id) || id < 1))
    return <div className="medical-stack"><ButtonLink variant="tertiary" to={MEDICAL_ROUTES.medicalSummary}>← Quay lại danh sách</ButtonLink><EmptyState title="Không tìm thấy ngựa" description="Chọn một ngựa trong Tóm tắt y tế." /></div>;
  return <div className="medical-stack">
    {id === null ? <PageHeader title="Tóm tắt y tế" description="Thông tin liên quan đến huấn luyện (chỉ xem)" /> : <ButtonLink variant="tertiary" to={MEDICAL_ROUTES.medicalSummary}>← Quay lại</ButtonLink>}
    {id === null && <Card title="Chọn ngựa">{!horses.data ? <State error={horses.error} retry={horses.retry} /> : horses.data.length === 0 ? <EmptyState title="Không có ngựa đang hoạt động" /> :
      <SelectField label="Ngựa" placeholder="Chọn ngựa" value="" options={horses.data.map((h) => ({ value: String(h.id), label: `${h.name} · ${h.horseCode}` }))} onChange={(event) => setParams({ horseId: event.target.value })} />}</Card>}
    {id !== null && <HorseSummary key={id} id={id} service={service} />}
  </div>;
}
function HorseSummary({ id, service }: { id: number; service: SummaryService }) {
  const horseLoad = useMemo(() => () => service.getHorse(id), [service, id]);
  const availabilityLoad = useMemo(() => () => service.getAvailability(id), [service, id]);
  const casesLoad = useMemo(() => () => service.listCases(), [service]);
  const horse = useRead(horseLoad, horseLoad), availability = useRead(availabilityLoad, availabilityLoad), cases = useRead(casesLoad, casesLoad);
  if (!horse.data) return <State error={horse.error} retry={horse.retry} />;
  const current = availability.data;
  const birth = horse.data.foaledDate?.split('-').map(Number), today = new Date();
  let age = birth ? today.getFullYear() - birth[0] : null;
  if (age !== null && birth && (today.getMonth() + 1 < birth[1] || (today.getMonth() + 1 === birth[1] && today.getDate() < birth[2]))) age--;
  const subtitle = [horse.data.horseCode, horse.data.breed, age !== null && age >= 0 ? `${age} tuổi` : undefined, sexLabel(horse.data.sex),
    [horse.data.yard, horse.data.currentBoxCode ? `Ô ${horse.data.currentBoxCode}` : undefined].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const open = cases.data?.filter((c) => c.horseId === id && c.status === 'OPEN');
  return <>
    <PageHeader title={`Tóm tắt y tế · ${horse.data.name}`} description={subtitle}
      actions={<span className="medical-read-only"><Icon name="eye" size={14} /> Chỉ xem</span>} />
    <div className="medical-summary-columns">
      <Card title="Tình trạng y tế liên quan huấn luyện" className="medical-summary-status">
        <dl>
          <Row label="Tình trạng sức khỏe">{horse.data.healthStatus ? <StatusBadge family="health" status={horse.data.healthStatus} /> : 'Chưa đánh giá'}</Row>
          <Row label="Khả năng tập luyện">{current ? <StatusBadge family="availability" status={current.availability} /> : 'Không khả dụng'}</Row>
          <Row label="Hạn chế đang áp dụng">{current ? current.availability === 'AVAILABLE' ? 'Không có' : current.reason || viLabel(current.availability) : 'Không khả dụng'}</Row>
          <Row label="Ca y tế đang mở">{open ? open.length ? open.map((c) => `Ca ${c.id}`).join(', ') : 'Không có' : 'Không khả dụng'}</Row>
          <Row label="Cân nặng ghi gần nhất">{horse.data.latestWeight ? <>{horse.data.latestWeight.weightKg} kg · <time dateTime={horse.data.latestWeight.recordedAt}>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(horse.data.latestWeight.recordedAt))}</time></> : 'Không có trong bản tóm tắt này'}</Row>
          <Row label="Lần khám tiếp theo">Không có trong bản tóm tắt này</Row>
        </dl>
        {!current ? <State error={availability.error} retry={availability.retry} /> :
          <AlertBanner type={current.availability === 'AVAILABLE' ? 'success' : 'warning'} title="Ảnh hưởng đến huấn luyện">
            {current.availability === 'AVAILABLE' ? 'Không có hạn chế y tế. Các kiểm tra lịch tập và mức sẵn sàng khác vẫn áp dụng.' : current.availability === 'LOCKED' ? 'Tập luyện đang bị khóa do hạn chế y tế hiện tại.' : current.reason || 'Tập luyện bị giới hạn. Hãy tuân theo các hạn chế bài tập hiện tại.'}
          </AlertBanner>}
        {!cases.data && <State error={cases.error} retry={cases.retry} />}
        {current?.exerciseRules?.length ? <div className="medical-stack"><h3>Hạn chế bài tập</h3>{current.exerciseRules.map((rule, index) => <p key={index}>{viLabel(rule.ruleType)}: {rule.exerciseTypeNote ?? `Bài tập ${rule.exerciseId}`}</p>)}</div> : null}
      </Card>
      <aside className="medical-stack">
        <AlertBanner type="info" title="Chỉ bản tóm tắt">Chi tiết y tế đầy đủ — chẩn đoán, phác đồ điều trị và đơn thuốc — chỉ dành cho đội thú y. Khả năng tập luyện và hạn chế do Veterinarian đặt.</AlertBanner>
        <Card title="Hạn chế toàn câu lạc bộ"><p>Hạn chế tập luyện do đội thú y kiểm soát. Bản tóm tắt này chỉ để xem.</p></Card>
      </aside>
    </div>
  </>;
}
