import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { AlertBanner, Button, Card, Drawer, EmptyState, Icon, KeyValue, SelectField, TextField } from '../../../design-system';
import { useAuth } from '../../../shared/auth/AuthProvider';
import type { Exercise, SupportingApi } from '../assigned/supportingApi';
import { SupportingReadState, SupportingShell } from '../assigned/SupportingShell';
import { useSupportingApi, useSupportingLoad } from '../assigned/supportingHooks';
import shared from '../assigned/supporting.module.css';
import { ExerciseBuilder } from './ExerciseBuilder';
import styles from './exercises.module.css';
import { exerciseSelectionTarget } from './exerciseValidation';
import { viLabel } from '../../../shared/viLabels';

export function ExerciseLibraryPage({ api: supplied }: { api?: SupportingApi }) {
  const api = useSupportingApi(supplied);
  return <SupportingShell title="Thư viện bài tập" roles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER', 'WORK_RIDER']}><Library api={api} /></SupportingShell>;
}
function Library({ api }: { api: SupportingApi }) {
  const { user } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const [params] = useSearchParams();
  const [query, setQuery] = useState(''); const [gait, setGait] = useState(''); const [filters, setFilters] = useState({ q: '', exerciseType: '' });
  const [drawer, setDrawer] = useState<number | null>(null); const [builder, setBuilder] = useState<Exercise | 'new' | null>(() => location.pathname.endsWith('/new') ? 'new' : null);
  const [notice, setNotice] = useState(''); const [selected, setSelected] = useState<number | null>(null);
  const rows = useSupportingLoad(() => api.exercises(filters), [api, filters.q, filters.exerciseType]);
  const returnTo = exerciseSelectionTarget(params.get('returnTo'));
  const canWrite = user?.roles.includes('TRAINER');
  const gaits = [...new Set((rows.data ?? []).flatMap((item) => item.exerciseType ? [item.exerciseType.toUpperCase()] : []))];
  const search = () => setFilters({ q: query, exerciseType: gait });
  function select(exercise: Exercise) {
    if (!returnTo) return;
    const target = new URL(returnTo, 'http://local.invalid'); target.searchParams.set('exerciseDefinitionId', String(exercise.id));
    setSelected(exercise.id); navigate(`${target.pathname}${target.search}`);
  }
  function closeBuilder() { setBuilder(null); if (location.pathname.endsWith('/new')) navigate('/training/exercise-library'); }
  return <div className={shared.stack}><div className={shared.header}><div><h1 className={shared.title}>Thư viện bài tập</h1><p className={shared.muted}>Các bài tập dùng lại được để xây dựng buổi tập.</p></div>{canWrite && <Button onClick={() => setBuilder('new')}><Icon name="plus" size={16} />Bài tập mới</Button>}</div>
    {notice && <AlertBanner type="success" title={notice} />}
    {returnTo && <AlertBanner type="info" title="Đang chọn bài tập cho buổi tập"><Link to={returnTo} className={shared.link}>Quay lại chọn bài tập</Link></AlertBanner>}
    <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); search(); }}><TextField label="Tìm bài tập" type="search" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bài tập…" /><SelectField label="Dáng chạy / loại" value={gait} onChange={(event) => { setGait(event.target.value); setFilters({ q: query, exerciseType: event.target.value }); }} options={[{ value: '', label: 'Tất cả' }, ...gaits.map((value) => ({ value, label: viLabel(value) }))]} /><Button type="submit" variant="secondary">Tìm kiếm</Button><span className={shared.caption}>{rows.data?.length ?? '—'} bài tập</span></form>
    <SupportingReadState error={rows.error} loading={!rows.data} retry={rows.retry} />
    {rows.data && (rows.data.length === 0 ? <EmptyState title="Không có bài tập" description="Hãy thử từ khóa hoặc bộ lọc dáng chạy khác." /> : <div className={styles.grid}>{rows.data.map((exercise) => <Card key={exercise.id} className={selected === exercise.id ? styles.selected : ''}><div className={styles.exercise}><h2>{exercise.name}</h2><p className={shared.caption}>{exercise.description || 'Chưa có mục đích.'}</p><div><span className={styles.gait}><Icon name="activity" size={12} />{exercise.exerciseType ? viLabel(exercise.exerciseType) : 'Chưa xác định dáng chạy'}</span></div><div className={styles.details}><span className={shared.caption}>Thông thường</span><span>{exercise.targetMetric || 'Chưa cung cấp'}</span></div><div className={styles.actions}><Button variant="tertiary" size="sm" aria-label={`Xem ${exercise.name}`} onClick={() => setDrawer(exercise.id)}>Xem</Button>{returnTo && canWrite ? <Button variant="secondary" size="sm" onClick={() => select(exercise)}>Chọn</Button> : <span className={shared.caption}>Chỉ định nghĩa</span>}</div></div></Card>)}</div>)}
    <AlertBanner type="info" title="Bài tập dùng lại được">Mức phù hợp với từng ngựa được kiểm tra khi lên lịch buổi tập. Cường độ, thẻ mục tiêu, mặt sân phù hợp và hướng dẫn hồi phục chưa có trong thư viện này.</AlertBanner>
    {drawer !== null && <ExerciseDetail key={drawer} id={drawer} api={api} onClose={() => setDrawer(null)} onSelect={returnTo && canWrite ? select : undefined} onEdit={canWrite ? (exercise) => { setDrawer(null); setBuilder(exercise); } : undefined} />}
    {builder && <ExerciseBuilder key={builder === 'new' ? 'new' : builder.id} api={api} initial={builder === 'new' ? undefined : builder} onClose={closeBuilder} onSaved={(exercise) => { setNotice(`Đã lưu bài tập ${exercise.name}`); closeBuilder(); rows.retry(); }} />}
  </div>;
}
function ExerciseDetail({ id, api, onClose, onSelect, onEdit }: { id: number; api: SupportingApi; onClose: () => void; onSelect?: (exercise: Exercise) => void; onEdit?: (exercise: Exercise) => void }) {
  const loaded = useSupportingLoad(() => api.exercise(id), [api, id]);
  const exercise = loaded.data;
  return <Drawer open title={exercise?.name ?? 'Chi tiết bài tập'} subtitle={['Định nghĩa bài tập', exercise?.exerciseType && viLabel(exercise.exerciseType)].filter(Boolean).join(' · ')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Đóng</Button>{exercise && onEdit && <Button variant="secondary" onClick={() => onEdit(exercise)}>Sửa bài tập</Button>}{exercise && onSelect && <Button onClick={() => onSelect(exercise)}>Chọn bài tập</Button>}</>}><SupportingReadState loading={!exercise} error={loaded.error} retry={loaded.retry} />{exercise && <div className={shared.stack}><section><h3 className={styles.sectionTitle}>Mục đích</h3><p>{exercise.description || 'Chưa cung cấp'}</p></section><KeyValue label="Dáng chạy / loại" value={exercise.exerciseType ? viLabel(exercise.exerciseType) : 'Chưa cung cấp'} /><section><h3 className={styles.sectionTitle}>Hướng dẫn quãng đường / thời lượng</h3><p>{exercise.targetMetric || 'Chưa cung cấp'}</p></section><section><h3 className={styles.sectionTitle}>Mặt sân phù hợp và hướng dẫn hồi phục</h3><p className={shared.muted}>Bài tập này chưa có hướng dẫn.</p></section><AlertBanner type="info" title="Mức phù hợp với ngựa">Mức phù hợp được đánh giá khi thêm bài tập này vào buổi tập.</AlertBanner></div>}</Drawer>;
}
