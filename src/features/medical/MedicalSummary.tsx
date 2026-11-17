import { boxLabel, yardLabel } from '../../shared/stableBox';
import { UiPreviewNotice } from './UiPreviewNotice';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { AlertBanner, ButtonLink, Card, EmptyState, ErrorState, Icon, LoadingState, SelectField, StatusBadge, TextField } from '../../design-system';
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
import styles from './MedicalSummary.module.css';

export function MedicalSummaryAccess() {
  const auth = useAuth(), actor = auth.user, token = authSession.read()?.accessToken;
  const service = useMemo(() => token ? createSummaryService(token, auth.handleApiError) : null, [token, auth.handleApiError]);
  if (auth.status !== 'authenticated' || !actor || actor.accountStatus !== 'ACTIVE' || !actor.roles.includes('HEAD_TRAINER') || !service)
    return <AlertBanner type="danger" title="Không có quyền truy cập" />;
  return <AppShell designSystem="v2" user={{ fullName: actor.fullName, role: 'HEAD_TRAINER' }} breadcrumb={[{ label: 'Tóm tắt y tế' }]}>
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
  return <div className={styles.fact}><dt>{label}</dt><dd>{children}</dd></div>;
}

function searchKey(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/đ/g, 'd');
}
/** Non-clinical, read-only Figma 274:9405. Missing DTO fields stay unavailable, never inferred. */
export function MedicalSummaryPage({ service }: { service: SummaryService }) {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const selected = params.get('horseId');
  const id = selected === null ? null : Number(selected);
  const listLoad = useMemo(() => () => service.listHorses(), [service]);
  const horses = useRead(listLoad, service);
  if (id !== null && (!/^\d+$/.test(selected!) || !Number.isSafeInteger(id) || id < 1))
    return <div className="medical-stack"><ButtonLink variant="tertiary" to={MEDICAL_ROUTES.medicalSummary}>← Quay lại danh sách</ButtonLink><EmptyState title="Không tìm thấy ngựa" description="Chọn một ngựa trong Tóm tắt y tế." /></div>;
  const filter = searchKey(query.trim());
  const matches = horses.data?.filter((horse) => searchKey(`${horse.name} ${horse.horseCode}`).includes(filter)) ?? [];
  const selectedHorse = horses.data?.find((horse) => horse.id === id);
  const choices = selectedHorse && !matches.includes(selectedHorse) ? [selectedHorse, ...matches] : matches;
  return <div className={styles.page}>
    <PageHeader title="Tóm tắt y tế" description="Tra cứu sức khỏe và khả năng tập luyện của ngựa."
      actions={<span className={styles.readOnly}><Icon name="eye" size={16} />Chỉ xem</span>} />
    <Card title="Chọn ngựa để xem">
      {!horses.data ? <State error={horses.error} retry={horses.retry} /> : horses.data.length === 0 ? <EmptyState title="Không có ngựa đang hoạt động" /> : <>
        <div className={styles.picker}>
          <TextField label="Tìm theo tên hoặc mã ngựa" type="search" placeholder="Ví dụ: RH-001" value={query} onChange={(event) => setQuery(event.target.value)} />
          <SelectField label="Ngựa" placeholder="Chọn ngựa" value={selectedHorse ? String(selectedHorse.id) : ''}
            options={choices.map((horse) => ({ value: String(horse.id), label: `${horse.name} · ${horse.horseCode}` }))}
            onChange={(event) => { if (event.target.value) setParams({ horseId: event.target.value }); }} />
        </div>
        {matches.length === 0 && <p className={styles.noResults} role="status">Không tìm thấy ngựa phù hợp. Hãy thử tên hoặc mã khác.</p>}
      </>}
    </Card>
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
    [yardLabel(horse.data.yard), horse.data.currentBoxCode ? `${boxLabel(horse.data.currentBoxCode)}` : undefined].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const open = cases.data?.filter((c) => c.horseId === id && c.status === 'OPEN');
  return <>
    <header className={styles.horseHeading}>
      <h2>{horse.data.name}</h2><p>{subtitle}</p>
    </header>
    <Card title="Khả năng tập luyện" className={styles.summaryCard}>
      {!current ? <State error={availability.error} retry={availability.retry} /> : <>
        <div><StatusBadge family="availability" status={current.availability} /></div>
        <AlertBanner type={current.availability === 'AVAILABLE' ? 'info' : current.availability === 'LOCKED' ? 'danger' : 'warning'} title="Ảnh hưởng đến huấn luyện">
          {current.availability === 'AVAILABLE' ? 'Không có hạn chế y tế. Các kiểm tra lịch tập và mức sẵn sàng khác vẫn áp dụng.' : current.reason || (current.availability === 'LOCKED' ? 'Tập luyện đang bị khóa do hạn chế y tế hiện tại.' : 'Tuân theo các hạn chế bài tập hiện tại.')}
        </AlertBanner>
        {current.exerciseRules?.length ? <div className={styles.rules}><h3>Hạn chế bài tập</h3><ul>{current.exerciseRules.map((rule, index) => <li key={index}>{viLabel(rule.ruleType)}: {rule.exerciseTypeNote ?? `Bài tập ${rule.exerciseId}`}</li>)}</ul></div> : null}
      </>}
    </Card>
    <Card title="Sức khỏe và theo dõi" className={styles.summaryCard}>
      <dl className={styles.facts}>
        <Row label="Tình trạng sức khỏe">{horse.data.healthStatus ? <StatusBadge family="health" status={horse.data.healthStatus} /> : 'Chưa đánh giá'}</Row>
        <Row label="Ca y tế đang mở">{open ? open.length ? open.map((c) => `Ca ${c.id}`).join(', ') : 'Không có' : 'Không khả dụng'}</Row>
        <Row label="Cân nặng ghi gần nhất">{horse.data.latestWeight ? <>{horse.data.latestWeight.weightKg} kg · <time dateTime={horse.data.latestWeight.recordedAt}>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(horse.data.latestWeight.recordedAt))}</time></> : 'Chưa có dữ liệu cân nặng'}</Row>
      </dl>
      {!cases.data && <State error={cases.error} retry={cases.retry} />}
    </Card>
  </>;
}
