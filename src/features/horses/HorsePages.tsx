import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ButtonLink, AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, KeyValue, LoadingState, SelectField, StatusBadge, TableToolbar, Tabs, TextField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { businessDataMode } from '../../shared/data/businessData';
import { useHorsesApi } from './api/HorsesApiContext';
import type { HorseDetail } from './api/types';
import { ageInYears, formatDate } from './shared/format';
import { useBreadcrumb } from './shared/HorseManagementLayout';
import styles from './shared/horses.module.css';
import { sexLabel } from './shared/options';
import { HorseHistoryPanel } from './history/HorseHistoryPanel';
import { ReadinessReview } from './history/ReadinessReview';
import historyStyles from './history/history.module.css';
import { viLabel } from '../../shared/viLabels';
import { dateTime } from '../evaluation/models';

function useHorseResource<T>(load: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data?: T; error?: string; source?: () => Promise<T> }>({});
  useEffect(() => { let active = true; load().then((data) => { if (active) setState({ data, source: load }); }, (error: unknown) => { if (active) setState({ error: error instanceof Error ? error.message : 'Không tải được danh sách ngựa.', source: load }); }); return () => { active = false; }; }, [load, revision]);
  return { ...(state.source === load ? state : {}), reload: () => { setState({}); setRevision((n) => n + 1); } };
}
function HorseState({ error, retry }: { error?: string; retry: () => void }) {
  return error ? <ErrorState title="Không tải được dữ liệu ngựa" description={error} onRetry={retry} /> : <LoadingState label="Đang tải danh sách ngựa…" />;
}
export function HorseListPage() {
  useBreadcrumb([{ label: 'Ngựa' }, { label: 'Tất cả ngựa' }]);
  const api = useHorsesApi();
  const { user } = useAuth();
  const canManage = user?.roles.includes('CLUB_MANAGER');
  const [search, setSearch] = useState(''), [lifecycle, setLifecycle] = useState(''), [availability, setAvailability] = useState('');
  const [query, setQuery] = useState({ q: '', lifecycle: '', availability: '', page: 0, size: 20 });
  const load = useCallback(() => api.listHorses(query), [api, query]);
  const { data, error, reload } = useHorseResource(load);
  return <div className={styles.page} data-ui-v3>
    <div className={styles.titleRow}><div className={styles.titleBlock}><h1 className="text-h1">Danh sách ngựa</h1><p>Danh sách ngựa của câu lạc bộ · nhận dạng, phả hệ, sở hữu và ô chuồng</p></div>{canManage && <><ButtonLink to="/horses/pending-activation">Chờ kích hoạt</ButtonLink><ButtonLink variant="primary" to="/horses/new">Thêm ngựa</ButtonLink></>}</div>
    <TableToolbar label="Bộ lọc danh sách ngựa" scope="server" resultCount={data?.totalItems}
      hasFilters={Boolean(search || lifecycle || availability || query.q || query.lifecycle || query.availability)}
      onClear={() => { setSearch(''); setLifecycle(''); setAvailability(''); setQuery({ q: '', lifecycle: '', availability: '', page: 0, size: query.size }); }}
      onSubmit={(e) => { e.preventDefault(); setQuery({ ...query, q: search, lifecycle, availability, page: 0 }); }}>
      <TextField label="Tìm ngựa" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      <SelectField label="Vòng đời" value={lifecycle} options={[{ value: '', label: 'Tất cả' }, ...['DRAFT', 'ACTIVE', 'INACTIVE'].map((value) => ({ value, label: viLabel(value) }))]} onChange={(e) => setLifecycle(e.target.value)} />
      <SelectField label="Khả năng tập luyện" value={availability} options={[{ value: '', label: 'Tất cả' }, ...['AVAILABLE', 'LIMITED', 'LOCKED'].map((value) => ({ value, label: viLabel(value) }))]} onChange={(e) => setAvailability(e.target.value)} />
      <Button type="submit" variant="secondary">Áp dụng bộ lọc</Button>
    </TableToolbar>
    {!data ? <HorseState error={error} retry={reload} /> : <>
      <Card><div className={styles.table}><DataTable<HorseDetail> caption="Danh sách ngựa" rows={data.items} rowKey={(h) => h.id} empty={<EmptyState title="Không có ngựa phù hợp" />} columns={[
        { key: 'name', header: 'Ngựa', width: '22%', render: (h) => <Link className={styles.horseIdentity} to={`/horses/${h.id}`}><strong>{h.name}</strong><span>{h.horseCode}</span></Link> },
        { key: 'breed', header: 'Giống · Tuổi · Giới tính', render: (h) => <div className={styles.horseFacts}><span>{h.breed ?? 'Chưa ghi nhận'}</span><small>{ageInYears(h.foaledDate) ?? '—'} tuổi · {sexLabel(h.sex)}</small></div> },
        { key: 'lifecycle', header: 'Vòng đời', render: (h) => <StatusBadge family="lifecycle" status={h.lifecycle} /> },
        { key: 'health', header: 'Sức khỏe', render: (h) => h.healthStatus ? <StatusBadge family="health" status={h.healthStatus} /> : 'Chờ khám ban đầu' },
        { key: 'availability', header: 'Khả năng tập luyện', width: 180, render: (h) => <div className={styles.horseFacts}><StatusBadge family="availability" status={h.trainingAvailability} />{h.lifecycle === 'DRAFT' && <small title="Chưa kích hoạt · chưa đủ điều kiện vận hành" aria-label="Chưa kích hoạt · chưa đủ điều kiện vận hành">Chờ kích hoạt</small>}</div> },
        { key: 'box', header: 'Ô chuồng', nowrap: true, render: (h) => h.currentBoxCode ?? 'Chưa phân công' },
        { key: 'action', header: 'Thao tác', width: 120, nowrap: true, render: (h) => <ButtonLink to={`/horses/${h.id}`}>{canManage ? 'Quản lý' : 'Xem'} →</ButtonLink> },
      ]} /></div><div className={styles.footer}><Button variant="secondary" disabled={!query.page} onClick={() => setQuery({ ...query, page: query.page - 1 })}>Trước</Button><span className="text-caption">Trang {data.page + 1}/{Math.max(1, data.totalPages)}</span><Button variant="secondary" disabled={query.page + 1 >= data.totalPages} onClick={() => setQuery({ ...query, page: query.page + 1 })}>Sau</Button></div></Card>
      <p className="text-caption">Sức khỏe và khả năng tập luyện chỉ xem ở đây. Ngựa Nháp vẫn chờ kích hoạt dù khả năng tập luyện là Sẵn sàng. Ngựa tự kích hoạt khi đủ mọi yêu cầu bắt buộc.</p>
    </>}
  </div>;
}
export function HorseProfilePage() {
  const { user, expiresAt } = useAuth(); const { id } = useParams();
  if (!user || user.accountStatus !== 'ACTIVE' || !user.roles.some((role) => ['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM'].includes(role))) return <ErrorState title="Không có quyền truy cập" description="Vai trò của bạn không xem được hồ sơ ngựa." />;
  return <HorseProfileContent key={`${user.id}:${expiresAt}:${id}`} />;
}
function HorseProfileContent() {
  const api = useHorsesApi(), { user } = useAuth();
  const location = useLocation();
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  // Unknown sections are rejected before any business request.
  const validTab = ['overview', 'pedigree', 'training', 'history'].includes(tab);
  const load = useCallback(() => Number.isSafeInteger(id) && id > 0 && validTab ? api.getHorse(id) : Promise.reject(new Error('Liên kết ngựa không hợp lệ')), [api, id, validTab]);
  const { data: horse, error, reload } = useHorseResource(load);
  const setTab = (value: string) => { const next = new URLSearchParams(params); next.set('tab', value); setParams(next); };
  const [photoError, setPhotoError] = useState(''), [uploading, setUploading] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const canManage = user?.roles.includes('CLUB_MANAGER');
  useBreadcrumb([{ label: 'Ngựa', to: '/horses' }, { label: horse?.name ?? 'Hồ sơ ngựa', ...(tab === 'history' ? { to: `/horses/${id}?tab=overview` } : {}) }, ...(tab === 'history' ? [{ label: 'Phả hệ & lịch sử' }] : [])]);
  if (!Number.isSafeInteger(id) || id < 1) return <EmptyState title="Không tìm thấy ngựa" />;
  if (!validTab) return <ErrorState title="Mục hồ sơ không hợp lệ" description="Hãy chọn một mục hồ sơ có sẵn." />;
  if (!horse) return <HorseState error={error} retry={reload} />;
  if (tab === 'history') return <HorseHistoryPanel horse={horse} />;
  return <div className={styles.page}><ButtonLink to="/horses">← Quay lại danh sách ngựa</ButtonLink>
    {(location.state as { photoUploadFailed?: boolean } | null)?.photoUploadFailed && <AlertBanner type="warning" title="Một số ảnh chưa được tải lên">Đã lưu thông tin nhận dạng. Hãy thêm lại các ảnh còn thiếu từ hồ sơ này.</AlertBanner>}
    <div className={styles.titleRow}>{horse.primaryPhotoUrl ? <img className={styles.profilePhoto} src={horse.primaryPhotoUrl} alt={horse.name} /> : <div className={styles.profilePhoto}>Chưa có ảnh</div>}<div className={styles.titleBlock}><h1 className="text-h1">{horse.name}</h1><p>{horse.horseCode} · {horse.breed} · {sexLabel(horse.sex)} · {horse.currentBoxCode ?? 'Chưa có ô chuồng'}</p><div className={styles.row}><StatusBadge family="lifecycle" status={horse.lifecycle} />{horse.healthStatus && <StatusBadge family="health" status={horse.healthStatus} />}<StatusBadge family="availability" status={horse.trainingAvailability} /></div></div>{canManage && <ButtonLink to={`/horses/${id}/identity`}>Sửa thông tin nhận dạng</ButtonLink>}</div>
    <ButtonLink to={`/horses/${id}?tab=history`}>Xem phả hệ &amp; lịch sử →</ButtonLink>
    {user?.roles.includes('VETERINARIAN') && <div className={styles.row}>{horse.lifecycle === 'DRAFT' && <ButtonLink variant="primary" to={`/horses/${id}/baseline`}>Ghi khám sức khỏe ban đầu →</ButtonLink>}<ButtonLink to={`/medical/restrictions?horseId=${id}`}>Khả năng tập luyện &amp; hạn chế →</ButtonLink></div>}
    <Tabs label="Các mục hồ sơ ngựa" idPrefix="horse-profile" value={tab} onChange={setTab} items={[{ value: 'overview', label: 'Tổng quan' }, { value: 'pedigree', label: 'Phả hệ & quyền sở hữu' }, { value: 'training', label: 'Huấn luyện & thành tích' }]} />
    {tab === 'overview' && <div role="tabpanel" id="horse-profile-panel-overview" aria-labelledby="horse-profile-tab-overview" tabIndex={0} className={styles.twoCol}><div className={styles.colMain}><Card title="Nhận dạng & sở hữu"><div className={historyStyles.profileFacts}><KeyValue label="Mã ngựa" value={horse.horseCode} /><KeyValue label="Tên đăng ký" value={horse.name} /><KeyValue label="Giống ngựa" value={horse.breed ?? 'Chưa ghi nhận'} /><KeyValue label="Giới tính" value={sexLabel(horse.sex) ?? 'Chưa ghi nhận'} /><KeyValue label="Tuổi" value={ageInYears(horse.foaledDate) == null ? 'Chưa ghi nhận' : `${ageInYears(horse.foaledDate)} tuổi`} /><KeyValue label="Cân nặng" value={horse.latestWeight && Number.isFinite(horse.latestWeight.weightKg) && horse.latestWeight.weightKg > 0 ? `${horse.latestWeight.weightKg} kg` : 'Chưa ghi nhận'} /><KeyValue label="Vòng đời" value={<StatusBadge family="lifecycle" status={horse.lifecycle} />} /><KeyValue label="Ngày sinh" value={formatDate(horse.foaledDate)} /><KeyValue label="Xuất xứ" value={horse.countryOfOrigin ?? 'Chưa ghi nhận'} /><KeyValue label="Số đăng ký" value={horse.registrationNo ?? 'Chưa ghi nhận'} /><KeyValue label="Chủ ngựa" value={horse.currentOwnerships?.map((o) => `${o.owner.fullName} · ${o.sharePercentage}%`).join(', ') || 'Chưa phân công'} /><KeyValue label="Ô chuồng" value={horse.currentBoxCode ?? 'Chưa phân công'} /></div></Card>
      {canManage && <Card title="Ảnh">{photoError && <AlertBanner type="danger" title={photoError} />}<Button variant="secondary" disabled={uploading} onClick={() => photoInput.current?.click()}>{uploading ? 'Đang tải lên…' : 'Thêm ảnh'}</Button><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Ảnh hồ sơ ngựa" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (!file || uploading) return; setUploading(true); setPhotoError(''); try { await api.uploadPhoto(id, file); reload(); } catch (error) { setPhotoError(error instanceof Error ? error.message : 'Tải ảnh lên thất bại.'); } finally { setUploading(false); } }} /></Card>}</div>
      <aside className={styles.colSide}><Card title="Sức khỏe & khả năng tập luyện"><p>{viLabel(horse.healthStatus, 'Chưa khám ban đầu')}</p><p>{viLabel(horse.trainingAvailability)}</p><p className="text-caption">Veterinarian phụ trách cập nhật sức khỏe và hạn chế. Ở đây không sửa được thông tin y tế.</p></Card><Card title="Kích hoạt & dòng thời gian"><KeyValue label="Kích hoạt lúc" value={horse.activatedAt ? <time dateTime={horse.activatedAt} title={horse.activatedAt}>{dateTime(horse.activatedAt)}</time> : 'Đang chờ đủ yêu cầu bắt buộc'} /><p className="text-caption">Thời điểm kích hoạt là mốc bắt đầu dòng thời gian của ngựa. Đánh giá sẵn sàng của Head Trainer không chặn việc kích hoạt.</p>{canManage && <ButtonLink to="/horses/pending-activation">Xem danh mục kích hoạt</ButtonLink>}</Card><ReadinessReview horseId={id} /></aside></div>}
    {tab === 'pedigree' && <div role="tabpanel" id="horse-profile-panel-pedigree" aria-labelledby="horse-profile-tab-pedigree" tabIndex={0}><Card title="Phả hệ & quyền sở hữu"><div className={styles.cardBody}><KeyValue label="Ngựa cha" value={horse.pedigree.sire.name ?? horse.pedigree.sire.horseCode ?? 'Không rõ'} /><KeyValue label="Ngựa mẹ" value={horse.pedigree.dam.name ?? horse.pedigree.dam.horseCode ?? 'Không rõ'} /><ul>{horse.currentOwnerships.map((o) => <li key={o.id}>{o.owner.fullName} · {o.sharePercentage}% · {formatDate(o.effectiveFrom)}{o.isManagingOwner ? ' · Chủ quản lý' : ''}</li>)}</ul>{canManage && <ButtonLink to={`/horses/${id}/edit`}>Sửa phả hệ, sở hữu & ô chuồng</ButtonLink>}</div></Card></div>}
    {tab === 'training' && <div role="tabpanel" id="horse-profile-panel-training" aria-labelledby="horse-profile-tab-training" tabIndex={0}><Card title="Huấn luyện & thành tích"><p>Mở không gian làm việc của bạn để tiếp tục công việc huấn luyện. Hồ sơ này không tính điểm tiến độ hay quãng đường.</p><ButtonLink to="/dashboard">Không gian huấn luyện →</ButtonLink>{businessDataMode() === 'sample' && id === 7 && !user?.roles.includes('GROOM') && <p><ButtonLink to="/training/sessions/42/evaluation">Kết quả & lịch sử buổi tập mẫu →</ButtonLink></p>}</Card></div>}
  </div>;
}
