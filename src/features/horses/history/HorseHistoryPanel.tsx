import { boxLabel, yardLabel } from '../../../shared/stableBox';
import { useEffect, useMemo, useState } from 'react';
import { ButtonLink, AlertBanner, Button, Card, EmptyState, ErrorState, KeyValue, LoadingState } from '../../../design-system';
import { useAuth } from '../../../shared/auth/AuthProvider';
import { ApiError } from '../../../shared/auth/authApi';
import type { HorseDetail, Ownership, Page, StableAssignment } from '../api/types';
import { formatDate } from '../shared/format';
import { sexLabel } from '../shared/options';
import { useHorseHistoryService } from './historyService';
import type { TimelineEvent } from './historyTypes';
import styles from './history.module.css';
import { serverText } from '../../../shared/serverText';

const missing = 'Không có';
function Message({ code, retry }: { code: number; retry(): void }) { return <ErrorState title={code === 403 ? 'Không có quyền truy cập' : code === 404 ? 'Không tìm thấy ngựa' : 'Không tải được lịch sử'} description={code === 403 ? 'Vai trò của bạn không được xem lịch sử của ngựa này.' : 'Hãy thử lại hoặc liên hệ câu lạc bộ.'} onRetry={code === 403 || code === 404 ? undefined : retry} />; }
export function HorseHistoryPanel({ horse }: { horse: HorseDetail }) {
  const { user, expiresAt } = useAuth();
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.some((r) => ['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM'].includes(r))) return <ErrorState title="Không có quyền truy cập" description="Vai trò của bạn không xem được lịch sử ngựa." />;
  return <History key={`${user.id}:${expiresAt}:${horse.id}`} horse={horse} />;
}
function History({ horse }: { horse: HorseDetail }) {
  const service = useHorseHistoryService();
  const { user, handleApiError } = useAuth();
  const fullHistory = user!.roles.some((r) => ['CLUB_MANAGER', 'HEAD_TRAINER'].includes(r));
  const [page, setPage] = useState(0), [revision, setRevision] = useState(0);
  const source = useMemo(() => ({ service, id: horse.id, page, revision, fullHistory, actorId: user!.id }), [service, horse.id, page, revision, fullHistory, user]);
  const [result, setResult] = useState<{ source: object; timeline?: Page<TimelineEvent>; ownerships?: Ownership[]; assignments?: StableAssignment[]; error?: number }>();
  useEffect(() => {
    const abort = new AbortController(); let active = true;
    const histories = source.fullHistory ? Promise.all([service.ownerships(source.id, abort.signal), service.assignments(source.id, abort.signal)]) : Promise.resolve([undefined, undefined] as const);
    Promise.all([service.timeline(source.id, source.page, abort.signal), histories]).then(([timeline, [ownerships, assignments]]) => { if (active) setResult({ source, timeline, ownerships, assignments }); }, (cause: unknown) => { if (active && !handleApiError(cause)) setResult({ source, error: cause instanceof ApiError ? cause.status : 500 }); });
    return () => { active = false; abort.abort(); };
  }, [source, service, handleApiError]);
  const current = result?.source === source ? result : undefined;
  const ownerNames = horse.currentOwnerships.map((ownership) => ownership.owner.fullName).join(', ') || missing;
  if (current?.error !== undefined) return <Message code={current.error} retry={() => setRevision((v) => v + 1)} />;
  if (!current?.timeline) return <LoadingState label="Đang tải lịch sử ngựa…" />;
  return <div className={styles.page}>
    <ButtonLink to={`/horses/${horse.id}?tab=overview`} className={styles.back}>← Quay lại hồ sơ ngựa</ButtonLink>
    <div><h1 className={styles.title}>Phả hệ &amp; lịch sử</h1><p className={styles.subtitle}>{horse.horseCode} · {horse.name} · {horse.breed ?? missing} · {sexLabel(horse.sex) ?? missing} · sinh {formatDate(horse.foaledDate)} · Chủ ngựa {ownerNames}</p></div>
    {service.source === 'sample' && <AlertBanner title="Lịch sử mẫu">Chỉ hiển thị dữ liệu mẫu dùng chung. Bản xem trước không có thêm lịch sử.</AlertBanner>}
    <h2 className={styles.sectionTitle}>Xuất xứ &amp; phả hệ</h2>
    <Card className={styles.section}><h3>Xuất xứ &amp; nhận dạng</h3><div className={styles.identityGrid}>
      <KeyValue label="Tên ngựa" value={horse.name} /><KeyValue label="Mã ngựa" value={horse.horseCode} /><KeyValue label="Giống ngựa" value={horse.breed ?? missing} />
      <KeyValue label="Quốc gia xuất xứ" value={horse.countryOfOrigin ?? missing} /><KeyValue label="Ngày sinh" value={formatDate(horse.foaledDate)} /><KeyValue label="Giới tính" value={sexLabel(horse.sex) ?? missing} />
      <KeyValue label="Người gây giống" value={missing} /><KeyValue label="Chủ hiện tại" value={ownerNames} /><span aria-hidden="true" /><KeyValue label="Ngựa cha" value={horse.pedigree.sire.name ?? horse.pedigree.sire.horseCode ?? missing} /><KeyValue label="Ngựa mẹ" value={horse.pedigree.dam.name ?? horse.pedigree.dam.horseCode ?? missing} />
    </div></Card>
    <Card className={styles.section}><h3>Cây phả hệ</h3><div className={styles.tree}>
      <div className={styles.ancestors}>{['Ông nội', 'Bà nội', 'Ông ngoại', 'Bà ngoại'].map((label) => <div className={styles.chip} key={label}><span>{missing}</span><small>{label}</small></div>)}</div>
      <span className={styles.arrow} aria-hidden="true">→</span><div className={styles.ancestors}>{[['Ngựa cha', horse.pedigree.sire], ['Ngựa mẹ', horse.pedigree.dam]].map(([label, parent]) => <div className={styles.chip} key={String(label)}><span>{typeof parent === 'object' ? parent.name ?? parent.horseCode ?? missing : missing}</span><small>{String(label)}</small></div>)}</div>
      <span className={styles.arrow} aria-hidden="true">→</span><div className={`${styles.chip} ${styles.subject}`}><span>{horse.name}</span><small>{horse.horseCode} · Ngựa đang xem</small></div>
    </div></Card>
    <Card className={styles.section}><h2>Sở hữu &amp; lịch sử</h2><div className={styles.identityGrid}><KeyValue label="Chủ hiện tại" value={ownerNames} /><KeyValue label="Số đăng ký" value={horse.registrationNo ?? missing} /><KeyValue label="Chuồng hiện tại" value={horse.currentAssignment ? <>{[yardLabel(horse.currentAssignment.yard), boxLabel(horse.currentAssignment.boxCode)].filter(Boolean).join(' · ')} (từ <time dateTime={horse.currentAssignment.effectiveFrom}>{horse.currentAssignment.effectiveFrom}</time>)</> : missing} /><KeyValue label="Bắt đầu dòng thời gian" value={horse.activatedAt ? <time dateTime={horse.activatedAt} title={horse.activatedAt}>{formatDate(horse.activatedAt)}</time> : 'Chưa kích hoạt'} /></div>
      {fullHistory ? <>
        <h3>Lịch sử sở hữu</h3>{current.ownerships?.length ? <ul className={styles.records}>{current.ownerships.map((o) => <li key={o.id}><strong>{o.owner.fullName} · {o.sharePercentage}%</strong><span>{formatDate(o.effectiveFrom)} – {o.effectiveTo ? formatDate(o.effectiveTo) : 'Chưa kết thúc'}{o.isManagingOwner ? ' · Chủ quản lý' : ''}</span></li>)}</ul> : <EmptyState title="Chưa có lịch sử sở hữu" />}
        <h3>Lịch sử xếp chuồng</h3>{current.assignments?.length ? <ul className={styles.records}>{current.assignments.map((a) => <li key={a.id}><strong>{[yardLabel(a.yard), boxLabel(a.boxCode)].filter(Boolean).join(' · ')}</strong><span>{formatDate(a.effectiveFrom)} – {a.effectiveTo ? formatDate(a.effectiveTo) : 'Chưa kết thúc'}</span></li>)}</ul> : <EmptyState title="Chưa có lịch sử xếp chuồng" />}
      </> : <p>Toàn bộ lịch sử sở hữu và xếp chuồng chỉ dành cho Club Manager và Head Trainer.</p>}
    </Card>
    <Card className={styles.section}><h2>Dòng thời gian của ngựa</h2><p className={styles.subtitle}>Dòng thời gian bắt đầu từ lúc kích hoạt tự động. Chỉ hiển thị tiêu đề sự kiện không thuộc chuyên môn y tế.</p>
      {current.timeline.items.length ? <ol className={styles.records}>{current.timeline.items.map((event, index) => <li key={`${event.occurredAt}:${index}`}><time dateTime={event.occurredAt} title={event.occurredAt}>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurredAt))}</time><span>{serverText(event.title)}</span></li>)}</ol> : <EmptyState title="Chưa có sự kiện nào" description="Thông tin kích hoạt, sở hữu và xếp chuồng vẫn hiện phía trên nếu vai trò của bạn được phép." />}
      <nav aria-label="Phân trang dòng thời gian" className={styles.pagination}><Button variant="secondary" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>Trước</Button><span>Trang {current.timeline.page + 1}/{Math.max(1, current.timeline.totalPages)}</span><Button variant="secondary" disabled={page + 1 >= current.timeline.totalPages} onClick={() => setPage((n) => n + 1)}>Sau</Button></nav>
    </Card>
    <p className={styles.subtitle}>Lịch sử huấn luyện thuộc phân hệ Huấn luyện; lịch sử y tế thuộc đội thú y.</p>
  </div>;
}
