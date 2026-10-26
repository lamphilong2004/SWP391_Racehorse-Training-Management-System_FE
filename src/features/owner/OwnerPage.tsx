import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { RequireAuth } from '../../app/RequireAuth';
import { ROUTES } from '../../app/routePaths';
import { ButtonLink, AlertBanner, Button, Card, EmptyState, ErrorState, Icon, KeyValue, LoadingState, StatusBadge, Tabs } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { PageHeader } from '../../layout/PageHeader';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import { OwnerContext } from './OwnerProvider';
import type { OwnerHorse } from './ownerModel';
import styles from './owner.module.css';
import { sexLabel } from '../horses/shared/options';

const tabs = [{ value: 'profile', label: 'Hồ sơ & phả hệ' }, { value: 'health', label: 'Sức khỏe & mức sẵn sàng' }, { value: 'training', label: 'Huấn luyện & thành tích' }];
const healthLabels = { FIT: 'Khỏe mạnh', MONITORING: 'Đang theo dõi', INJURED: 'Đang được thú y chăm sóc', QUARANTINED: 'Đang được thú y chăm sóc' };
const readinessLabels = { AVAILABLE: 'Được tập bình thường', LIMITED: 'Vẫn tập trong giới hạn của thú y', LOCKED: 'Veterinarian đã tạm dừng tập luyện' };
const missing = 'Chưa chia sẻ';
const calendar = (iso: string | null) => iso ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso)) : missing;
const timestamp = (iso: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
function age(born: string | null, unit = 'tuổi') {
  if (!born) return null;
  const birth = new Date(born), now = new Date();
  const years = now.getUTCFullYear() - birth.getUTCFullYear() - Number(now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate()));
  return years >= 0 ? `${years} ${unit}` : null;
}
const meta = (horse: OwnerHorse) => [horse.code, horse.breed, age(horse.born), sexLabel(horse.sex)].filter(Boolean).join(' · ');

export function OwnerPage() { return <RequireAuth><OwnerAccess /></RequireAuth>; }
function OwnerAccess() {
  const { user, expiresAt } = useAuth();
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.includes('HORSE_OWNER')) return <main className="auth-problem"><ErrorState title="Không có quyền truy cập" description="Cổng này chỉ dành cho Horse Owner." /><ButtonLink variant="tertiary" to={ROUTES.dashboard}>← Quay lại không gian làm việc</ButtonLink></main>;
  return <OwnerContent key={`${user.id}:${expiresAt}`} />;
}
function OwnerContent() {
  const { user, handleApiError } = useAuth();
  const service = useContext(OwnerContext);
  const { horseId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = params.get('tab') ?? 'profile';
  const id = horseId && /^\d+$/.test(horseId) ? Number(horseId) : NaN;
  const valid = (!horseId || (Number.isSafeInteger(id) && id > 0)) && (!horseId || tabs.some((item) => item.value === tab));
  const [revision, setRevision] = useState(0);
  const [searchEpoch, setSearchEpoch] = useState(0);
  const source = useMemo(() => ({ service, id, horseId, valid, revision, actorId: user!.id }), [service, id, horseId, valid, revision, user]);
  const [result, setResult] = useState<{ source: object; horses?: OwnerHorse[]; error?: number } | null>(null);
  useEffect(() => {
    if (!source.valid) return;
    let active = true; const controller = new AbortController();
    const context = { actorId: source.actorId, signal: controller.signal };
    const pending = source.horseId ? source.service.detail(source.id, context).then((horse) => [horse]) : source.service.list(context);
    pending.then((horses) => { if (active) setResult({ source, horses }); }).catch((cause: unknown) => {
      if (active && !handleApiError(cause)) setResult({ source, error: cause instanceof ApiError ? cause.status : 500 });
    });
    return () => { active = false; controller.abort(); };
  }, [source, handleApiError]);
  const current = result?.source === source ? result : null;
  const horse = current?.horses?.[0];
  const search = (value: string) => { const next = new URLSearchParams(); if (value.trim()) next.set('q', value.trim()); navigate(`${ROUTES.myHorses}${next.size ? `?${next}` : ''}`); };
  const query = (params.get('q') ?? '').toLocaleLowerCase();
  const horses = current?.horses?.filter((item) => `${item.name} ${item.code}`.toLocaleLowerCase().includes(query));
  return <AppShell designSystem="v2" key={searchEpoch} user={{ fullName: user!.fullName, role: 'HORSE_OWNER' }} breadcrumb={[{ label: 'Ngựa của tôi', to: ROUTES.myHorses }, ...(horseId ? [{ label: horse?.name ?? 'Chi tiết ngựa' }] : [])]} searchPlaceholder="Tìm ngựa của tôi…" onSearch={search}>
    <div className={styles.page}>
      {service.source === 'sample' && <AlertBanner title="Dữ liệu mẫu · Bản xem trước này chưa đối chiếu với dữ liệu thật." />}
      {horseId && <Link className={styles.back} to={ROUTES.myHorses}>← Ngựa của tôi</Link>}
      {!valid ? <ErrorState title="Liên kết ngựa không hợp lệ" description="Hãy kiểm tra mã ngựa và tab đã chọn." /> : current?.error !== undefined ? <><ErrorState title={current.error === 403 ? 'Không có quyền truy cập' : current.error === 404 ? 'Không tìm thấy ngựa' : 'Không tải được thông tin chủ ngựa'} description={current.error === 403 || current.error === 404 ? 'Ngựa này không có trong cổng của bạn.' : 'Hãy thử lại sau hoặc liên hệ câu lạc bộ.'} onRetry={[403, 404].includes(current.error) ? undefined : () => setRevision((value) => value + 1)} />{!horseId && <ButtonLink variant="tertiary" to={ROUTES.dashboard}>← Quay lại không gian làm việc</ButtonLink>}</> : !current?.horses ? <LoadingState label="Đang tải ngựa của bạn…" /> : horseId && horse ? <>
        <Card className={styles.horseHeader}><Photo horse={horse} detail /><div className={styles.headerName}><h1>{horse.name}</h1><p>{[meta(horse), horse.stable].filter(Boolean).join(' · ')}</p><Badges horse={horse} /></div><span className={styles.readOnly}><Icon name="eye" size={14} />CHỈ XEM</span></Card>
        <Tabs items={tabs} value={tab} label="Thông tin ngựa" idPrefix="owner-horse" onChange={(value) => { const next = new URLSearchParams(params); next.set('tab', value); setParams(next); }} />
        <div role="tabpanel" id={`owner-horse-panel-${tab}`} aria-labelledby={`owner-horse-tab-${tab}`} tabIndex={0}>
          {tab === 'profile' ? <Profile horse={horse} /> : tab === 'health' ? <Health horse={horse} /> : <Training horse={horse} />}
        </div>
      </> : <>
        <PageHeader title="Ngựa của tôi" description={`Xin chào, ${user!.fullName} · ${current.horses.length} con ngựa đứng tên bạn · ${new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())} · chế độ chỉ xem`} />
        <AlertBanner className={styles.note} title="Bạn chỉ thấy các ngựa đứng tên mình. Ngựa khác của câu lạc bộ không hiện trong cổng này. Thông tin chỉ để xem — nhân viên câu lạc bộ cập nhật." />
        {query && <div className={styles.searchResult}>Kết quả tìm kiếm cho “{params.get('q')}” trong ngựa của bạn <Button variant="tertiary" onClick={() => { setParams({}); setSearchEpoch((value) => value + 1); }}>Xóa tìm kiếm</Button></div>}
        {!horses?.length ? <EmptyState title={query ? 'Không có ngựa phù hợp' : 'Chưa có ngựa nào đứng tên bạn'} description="Liên hệ câu lạc bộ nếu bạn nghĩ còn thiếu ngựa trong cổng của mình." /> : <div className={styles.horseGrid}>{horses.map((item, index) => <Card key={item.id} className={styles.horseCard}><div className={styles.cardTop}><Photo horse={item} /><div><h2>{item.name}</h2><p className={styles.caption}>{meta(item)}</p></div></div><Badges horse={item} /><div className={styles.divider} /><Facts><Fact label="Sức khỏe" value={item.health ? healthLabels[item.health] : missing} /><Fact label="Mức sẵn sàng" value={item.availability ? readinessLabels[item.availability] : missing} /><Fact label="Huấn luyện" value={item.program === undefined ? 'Xem trang của ngựa' : item.program ? [item.program.name, item.program.phase].filter(Boolean).join(' · ') : 'Chưa có chương trình'} /><Fact label="Buổi tập tiếp theo" value={item.nextSession ? `${timestamp(item.nextSession.date)} · ${item.nextSession.title ?? missing}` : 'Hiện khi có lịch buổi tập tiếp theo'} /></Facts><Link className={`${styles.viewLink} ${index ? styles.secondaryLink : ''}`} aria-label={`Xem ngựa ${item.name}`} to={`${ROUTES.myHorses}/${item.id}`}>Xem ngựa<span className="sr-only"> {item.name}</span></Link></Card>)}</div>}
      </>}
    </div>
  </AppShell>;
}
function Photo({ horse, detail = false }: { horse: OwnerHorse; detail?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`${styles.photo} ${detail ? styles.detailPhoto : ''}`}>{horse.photo && !failed ? <img src={horse.photo} alt={`${horse.name}`} onError={() => setFailed(true)} /> : <Icon name={detail ? 'image' : 'horseshoe'} size={detail ? 32 : 28} />}</div>;
}
function Badges({ horse }: { horse: OwnerHorse }) { return <div className={styles.badges}>{horse.lifecycle && <StatusBadge family="lifecycle" status={horse.lifecycle} />}{horse.health && <StatusBadge family="health" status={horse.health} />}{horse.availability && <StatusBadge family="availability" status={horse.availability} />}</div>; }
function Facts({ children }: { children: ReactNode }) { return <div className={styles.facts}>{children}</div>; }
function Fact({ label, value }: { label: string; value: ReactNode }) { return <KeyValue className={styles.fact} label={label} value={value ?? missing} />; }
function Section({ title, children }: { title: string; children: ReactNode }) { return <Card className={styles.section}><h2>{title}</h2>{children}</Card>; }
function Profile({ horse }: { horse: OwnerHorse }) {
  return <div className={styles.columns}><div className={styles.stack}><Section title="Hồ sơ"><Facts><Fact label="Tên đăng ký" value={horse.name} /><Fact label="Mã ngựa" value={horse.code} /><Fact label="Giống ngựa" value={horse.breed} /><Fact label="Giới tính" value={sexLabel(horse.sex)} /><Fact label="Ngày sinh" value={[calendar(horse.born), age(horse.born, 'tuổi')].filter(Boolean).join(' · ')} /><Fact label="Quốc gia xuất xứ" value={horse.country} /><Fact label="Chuồng" value={horse.stable ? `${horse.stable}${horse.stableSince ? ` (từ ${calendar(horse.stableSince)})` : ''}` : missing} /></Facts></Section>
    <Section title="Phả hệ"><div className={styles.pedigree}><div className={styles.ancestor}><small>Ngựa</small><strong>{horse.name}</strong></div><div className={styles.stack}><div className={styles.ancestor}><small>Ngựa cha</small><strong>{horse.sire ?? missing}</strong></div><div className={styles.ancestor}><small>Ngựa mẹ</small><strong>{horse.dam ?? missing}</strong></div></div><div className={styles.stack}>{['Ông nội', 'Bà nội', 'Ông ngoại', 'Bà ngoại'].map((label) => <div className={`${styles.ancestor} ${styles.unknownAncestor}`} key={label}><small>{label}</small><span>{missing}</span></div>)}</div></div></Section></div>
    <aside className={styles.stack}><Section title="Quyền sở hữu"><p className={styles.ownershipStatement}>{horse.name} đã được liên kết với tài khoản của bạn.</p><p className={styles.caption}>Hồ sơ sở hữu do Club Manager quản lý. Liên hệ câu lạc bộ nếu thấy thông tin chưa đúng.</p></Section><AlertBanner className={styles.note} title="Cổng này chỉ để xem. Hồ sơ ngựa, sức khỏe và huấn luyện do nhân viên câu lạc bộ quản lý." /></aside></div>;
}
function Health({ horse }: { horse: OwnerHorse }) {
  const weight = horse.healthSummary?.weights[0];
  return <div className={styles.columns}><div className={styles.stack}>
    <Section title="Sức khỏe & mức sẵn sàng">
      <p className={styles.caption}>Bản tóm tắt dành cho chủ ngựa, do Veterinarian của câu lạc bộ cập nhật.</p>
      <div className={styles.healthFacts}>
        <Fact label="Sức khỏe" value={<span className={styles.badges}>{horse.health && <StatusBadge family="health" status={horse.health} />}{horse.health ? healthLabels[horse.health] : missing}</span>} />
        <Fact label="Mức sẵn sàng tập luyện" value={<span className={styles.badges}>{horse.availability && <StatusBadge family="availability" status={horse.availability} />}{horse.availability ? readinessLabels[horse.availability] : missing}</span>} />
        <Fact label="Giới hạn tập luyện" value="Chưa có tóm tắt cho chủ ngựa" />
        <Fact label="Lần khám sức khỏe tiếp theo" value={calendar(horse.healthSummary?.reviewDate ?? null)} />
      </div>
    </Section>
    <Section title="Cân nặng">
      {weight ? <div className={styles.weightValue}><p className={styles.weight}>{weight.weightKg} kg</p><p className={styles.caption}>ghi gần nhất <time dateTime={weight.recordedAt} title={weight.recordedAt}>{calendar(weight.recordedAt)}</time></p></div> : <p className={styles.weight}>{missing}</p>}
      <p className={styles.caption}>Biểu đồ cân nặng sẽ hiện ở đây khi có thêm số đo.</p>
    </Section>
  </div><aside className={styles.stack}><Section title="Ý nghĩa"><h3>Sức khỏe</h3><ul><li>Khỏe mạnh</li><li>Đang theo dõi</li><li>Đang được thú y chăm sóc</li></ul><h3>Mức sẵn sàng tập luyện</h3><ul><li>Sẵn sàng — được tập bình thường</li><li>Hạn chế — vẫn tập trong giới hạn do Veterinarian đặt</li><li>Khóa — Veterinarian đã tạm dừng tập luyện</li></ul></Section><AlertBanner className={styles.note} title="Cổng này không hiển thị chi tiết y tế như chẩn đoán, điều trị và thuốc. Chỉ Veterinarian được thay đổi sức khỏe hoặc mức sẵn sàng." /></aside></div>;
}
function Training({ horse }: { horse: OwnerHorse }) {
  return <div className={styles.columns}><div className={styles.stack}><Section title="Chương trình huấn luyện hiện tại">{horse.program ? <><Facts><Fact label="Chương trình" value={horse.program.name} /><Fact label="Giai đoạn hiện tại" value={horse.program.phase} /><Fact label="Thời gian" value={`${calendar(horse.program.from)} – ${calendar(horse.program.to)}`} /><Fact label="Trainer" value={horse.program.trainer} /></Facts><Fact label="Tiến độ chương trình" value={horse.program.completed !== undefined && horse.program.planned !== undefined ? `${horse.program.completed} / ${horse.program.planned} buổi tập đã hoàn thành` : missing} /></> : <EmptyState title="Chưa có chương trình huấn luyện" description="Tóm tắt chương trình sẽ hiện ở đây khi câu lạc bộ chia sẻ." />}</Section><Section title="Buổi tập gần đây">{horse.sessions.length ? <div>{horse.sessions.map((session) => <div className={styles.session} key={session.id}><time title={session.date} dateTime={session.date}>{calendar(session.date)}</time><strong>{session.title ?? missing}</strong><span>{session.distanceM == null ? missing : `${new Intl.NumberFormat('vi-VN').format(session.distanceM)} m`}</span><StatusBadge family="session" status={session.status} /></div>)}</div> : <EmptyState title="Chưa có buổi tập nào" />}</Section><Section title="Cập nhật từ Trainer"><div className={styles.quote}><Icon name="user" size={16} /><p>Chưa có cập nhật.</p></div></Section></div><aside className={styles.stack}><Section title="Buổi tập tiếp theo">{horse.nextSession ? <><strong><time dateTime={horse.nextSession.date} title={horse.nextSession.date}>{timestamp(horse.nextSession.date)}{horse.nextSession.end ? ` – ${new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short' }).format(new Date(horse.nextSession.end))}` : ''}</time></strong><p className={styles.caption}>{[horse.nextSession.title, horse.nextSession.phase].filter(Boolean).join(' · ') || missing}</p></> : <p className={styles.caption}>Hiện khi có lịch buổi tập tiếp theo</p>}</Section><AlertBanner className={styles.note} title="Bạn có thể theo dõi việc huấn luyện ở đây. Chương trình, buổi tập và người cưỡi do các huấn luyện viên của câu lạc bộ quản lý." /></aside></div>;
}
