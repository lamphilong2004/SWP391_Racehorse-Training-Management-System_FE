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

export function ExerciseLibraryPage({ api: supplied }: { api?: SupportingApi }) {
  const api = useSupportingApi(supplied);
  return <SupportingShell title="Exercise Library" roles={['TRAINER', 'HEAD_TRAINER', 'VETERINARIAN', 'CLUB_MANAGER', 'WORK_RIDER']}><Library api={api} /></SupportingShell>;
}
function Library({ api }: { api: SupportingApi }) {
  const { user } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const [params] = useSearchParams();
  const [query, setQuery] = useState(''); const [gait, setGait] = useState(''); const [filters, setFilters] = useState({ q: '', exerciseType: '' });
  const [drawer, setDrawer] = useState<number | null>(null); const [builder, setBuilder] = useState<Exercise | 'new' | null>(() => location.pathname.endsWith('/new') ? 'new' : null);
  const [notice, setNotice] = useState(''); const [selected, setSelected] = useState<number | null>(null);
  const rows = useSupportingLoad(() => api.exercises(filters), [api, filters.q, filters.exerciseType]);
  const returnTo = exerciseSelectionTarget(params.get('returnTo'));
  const canWrite = user?.roles.includes('TRAINER');
  const gaits = [...new Set((rows.data ?? []).flatMap((item) => item.exerciseType ? [item.exerciseType] : []))];
  const search = () => setFilters({ q: query, exerciseType: gait });
  function select(exercise: Exercise) {
    if (!returnTo) return;
    const target = new URL(returnTo, 'http://local.invalid'); target.searchParams.set('exerciseDefinitionId', String(exercise.id));
    setSelected(exercise.id); navigate(`${target.pathname}${target.search}`);
  }
  function closeBuilder() { setBuilder(null); if (location.pathname.endsWith('/new')) navigate('/training/exercise-library'); }
  return <div className={shared.stack}><div className={shared.header}><div><h1 className={shared.title}>Exercise Library</h1><p className={shared.muted}>Reusable exercise definitions for building training sessions.</p></div>{canWrite && <Button onClick={() => setBuilder('new')}><Icon name="plus" size={16} />New Exercise</Button>}</div>
    {notice && <AlertBanner type="success" title={notice} />}
    {returnTo && <AlertBanner type="info" title="Selecting exercises for a training session"><Link to={returnTo} className={shared.link}>Back to Exercise Selection</Link></AlertBanner>}
    <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); search(); }}><TextField label="Search exercises" type="search" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises…" /><SelectField label="Gait / type" value={gait} onChange={(event) => { setGait(event.target.value); setFilters({ q: query, exerciseType: event.target.value }); }} options={[{ value: '', label: 'All' }, ...gaits.map((value) => ({ value, label: value }))]} /><Button type="submit" variant="secondary">Search</Button><span className={shared.caption}>{rows.data?.length ?? '—'} exercises</span></form>
    <SupportingReadState error={rows.error} loading={!rows.data} retry={rows.retry} />
    {rows.data && (rows.data.length === 0 ? <EmptyState title="No exercises" description="Try a different search or gait filter." /> : <div className={styles.grid}>{rows.data.map((exercise) => <Card key={exercise.id} className={selected === exercise.id ? styles.selected : ''}><div className={styles.exercise}><h2>{exercise.name}</h2><p className={shared.caption}>{exercise.description || 'No purpose supplied.'}</p><div><span className={styles.gait}><Icon name="activity" size={12} />{exercise.exerciseType || 'Gait not specified'}</span></div><div className={styles.details}><span className={shared.caption}>Typical</span><span>{exercise.targetMetric || 'Not supplied'}</span></div><div className={styles.actions}><Button variant="tertiary" size="sm" aria-label={`View ${exercise.name}`} onClick={() => setDrawer(exercise.id)}>View</Button>{returnTo && canWrite ? <Button variant="secondary" size="sm" onClick={() => select(exercise)}>Select</Button> : <span className={shared.caption}>Definition only</span>}</div></div></Card>)}</div>)}
    <AlertBanner type="info" title="Reusable exercise definitions">Horse-specific suitability is checked when scheduling a training session. Intensity, training-goal tags, surface suitability and recovery guidance are not available in this library yet.</AlertBanner>
    {drawer !== null && <ExerciseDetail key={drawer} id={drawer} api={api} onClose={() => setDrawer(null)} onSelect={returnTo && canWrite ? select : undefined} onEdit={canWrite ? (exercise) => { setDrawer(null); setBuilder(exercise); } : undefined} />}
    {builder && <ExerciseBuilder key={builder === 'new' ? 'new' : builder.id} api={api} initial={builder === 'new' ? undefined : builder} onClose={closeBuilder} onSaved={(exercise) => { setNotice(`Exercise ${exercise.name} saved`); closeBuilder(); rows.retry(); }} />}
  </div>;
}
function ExerciseDetail({ id, api, onClose, onSelect, onEdit }: { id: number; api: SupportingApi; onClose: () => void; onSelect?: (exercise: Exercise) => void; onEdit?: (exercise: Exercise) => void }) {
  const loaded = useSupportingLoad(() => api.exercise(id), [api, id]);
  const exercise = loaded.data;
  return <Drawer open title={exercise?.name ?? 'Exercise detail'} subtitle="Reusable exercise definition" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Close</Button>{exercise && onEdit && <Button variant="secondary" onClick={() => onEdit(exercise)}>Edit Exercise</Button>}{exercise && onSelect && <Button onClick={() => onSelect(exercise)}>Select Exercise</Button>}</>}><SupportingReadState loading={!exercise} error={loaded.error} retry={loaded.retry} />{exercise && <div className={shared.stack}><section><h3 className={styles.sectionTitle}>Purpose</h3><p>{exercise.description || 'Not supplied'}</p></section><KeyValue label="Gait / type" value={exercise.exerciseType ?? 'Not supplied'} /><section><h3 className={styles.sectionTitle}>Distance / duration guidance</h3><p>{exercise.targetMetric || 'Not supplied'}</p></section><section><h3 className={styles.sectionTitle}>Surface suitability and recovery guidance</h3><p className={shared.muted}>This guidance is not available for this exercise yet.</p></section><AlertBanner type="info" title="Horse suitability">Suitability is evaluated when this definition is added to a session.</AlertBanner></div>}</Drawer>;
}
