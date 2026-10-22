import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { ButtonLink, AlertBanner, Button, Card, Checkbox, Drawer, EmptyState, ErrorState, KeyValue, LoadingState, Modal, SelectField, TextAreaField, TextField, UnsavedChangesGuard } from '../../design-system';
import { errorMessage, useFlowRequest } from '../main-flows/api';
import { FlowShell } from '../main-flows/FlowShell';
import { useResource } from '../main-flows/useResource';
import type { TemplateDetail } from './programTypes';
import { createTemplateLibraryApi, templateInput, type TemplateInput } from './templateLibraryApi';
import styles from '../main-flows/flow.module.css';

type Api = ReturnType<typeof createTemplateLibraryApi>;
/** Figma Program Template Library 120:5086: filter, card grid, detail drawer, versioned editor. */
export function TemplateLibraryPage() {
  const request = useFlowRequest(), api = useMemo(() => createTemplateLibraryApi(request), [request]);
  const [status, setStatus] = useState('ACTIVE'), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number>(), [editor, setEditor] = useState<TemplateDetail | 'new'>(), [notice, setNotice] = useState('');
  const load = useCallback((signal: AbortSignal) => api.list(status, search, page, signal), [api, status, search, page]);
  const resource = useResource(load);
  return <FlowShell title="Program Templates" description="Reusable training strategies. Saving a new version never changes an existing horse program." section="Training" role="HEAD_TRAINER" actions={<Button onClick={() => setEditor('new')}>Create Template</Button>}>
    {notice && <AlertBanner type="success" title={notice} />}
    <Card><form className={styles.row} onSubmit={(event) => { event.preventDefault(); setPage(0); setSearch(query); }}>
      <TextField label="Search templates" type="search" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} />
      <SelectField label="Template status" value={status} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'ARCHIVED', label: 'Archived' }]} onChange={(event) => { setStatus(event.target.value); setPage(0); }} />
      <Button type="submit" variant="secondary">Search</Button><ButtonLink to="/training/programs">Horse Training Programs</ButtonLink>
    </form></Card>
    {resource.pending && <LoadingState label="Loading Program Template Library…" />}
    {resource.error && <ErrorState title="Template Library unavailable" description={resource.error} onRetry={resource.reload} />}
    {resource.data && <>{resource.data.items.length === 0 ? <EmptyState title="No templates found" description="Create a template or adjust the filters." /> : <div className={styles.fields}>{resource.data.items.map((template) => <Card key={template.id} title={template.name}><div className={styles.stack}>
      <p>{template.goals || 'Goals not provided.'}</p><KeyValue label="Template" value={template.templateCode} /><KeyValue label="Version" value={`v${template.latestVersionNo}`} /><KeyValue label="Status" value={template.status} />
      <Button variant="secondary" onClick={() => setSelected(template.id)}>View {template.name}</Button>
    </div></Card>)}</div>}
      <div className={styles.row}><Button variant="secondary" disabled={page === 0 || resource.pending} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1} · {resource.data.totalItems} templates</span><Button variant="secondary" disabled={page + 1 >= resource.data.totalPages || resource.pending} onClick={() => setPage(page + 1)}>Next</Button></div>
    </>}
    {selected && <TemplateDrawer key={selected} id={selected} api={api} onClose={() => setSelected(undefined)} onEdit={(detail) => { setSelected(undefined); setEditor(detail); }} onChanged={(message) => { setSelected(undefined); setNotice(message); resource.reload(); }} />}
    {editor && <TemplateEditor key={editor === 'new' ? 'new' : `${editor.template.id}-${editor.version.versionNo}`} api={api} initial={editor === 'new' ? undefined : editor} onClose={() => setEditor(undefined)} onSaved={(detail) => { setNotice(`Template ${detail.version.name} · version ${detail.version.versionNo} saved`); setEditor(undefined); resource.reload(); }} />}
  </FlowShell>;
}

function TemplateDrawer({ id, api, onClose, onEdit, onChanged }: { id: number; api: Api; onClose: () => void; onEdit: (detail: TemplateDetail) => void; onChanged: (message: string) => void }) {
  const [version, setVersion] = useState<number>(), [confirm, setConfirm] = useState<'archive' | 'duplicate'>(), [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false), load = useCallback((signal: AbortSignal) => api.read(id, version, signal), [api, id, version]);
  const resource = useResource(load), data = resource.data;
  async function action() {
    if (pending.current || !data || !confirm || confirm === 'duplicate' && !name.trim()) return;
    pending.current = true; setBusy(true); setError('');
    try { if (confirm === 'archive') { await api.archive(id); onChanged('Template archived; existing horse programs retain their source version.'); }
      else { await api.duplicate(id, name.trim(), data.version.versionNo); onChanged('Template duplicate confirmed by the server.'); } }
    catch (failure) { setError(errorMessage(failure)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Drawer open title={data?.version.name ?? 'Program Template Detail'} subtitle={data ? `${data.template.templateCode} · v${data.version.versionNo} · ${data.template.status}` : undefined} onClose={busy ? () => undefined : onClose} dismissible={!busy} footer={<>
    <Button variant="secondary" disabled={busy} onClick={onClose}>Close</Button>{data && <><Button variant="secondary" disabled={busy} onClick={() => { setName(`${data.version.name} copy`.slice(0, 150)); setConfirm('duplicate'); }}>Duplicate</Button>{data.template.status === 'ACTIVE' && <><Button variant="secondary" disabled={busy || data.version.versionNo !== data.template.latestVersionNo} onClick={() => onEdit(data)}>Save New Version</Button><Button variant="destructive" disabled={busy} onClick={() => setConfirm('archive')}>Archive</Button></>}</>}
  </>}>
    {resource.pending && <LoadingState label="Loading template…" />}{resource.error && <ErrorState title="Template unavailable" description={resource.error} onRetry={resource.reload} />}
    {data && <div className={styles.stack}><SelectField label="Template version" value={String(data.version.versionNo)} options={data.versions.map((item) => ({ value: String(item.versionNo), label: `Version ${item.versionNo}` }))} onChange={(event) => setVersion(Number(event.target.value))} />
      <KeyValue label="Goals" value={data.version.goals ?? 'Not supplied'} /><KeyValue label="Suitable horse profile" value={data.version.suitableHorseProfile ?? 'Not supplied'} /><KeyValue label="Recommended duration" value={data.version.recommendedDuration ?? 'Not supplied'} /><KeyValue label="Preferred surfaces" value={data.version.preferredSurfaces ?? 'Not supplied'} /><KeyValue label="Recovery guidance" value={data.version.recoveryGuidance ?? 'Not supplied'} />
      <h3>Phase structure</h3>{data.version.phases.map((phase) => <Card key={phase.id} title={`${phase.phaseOrder}. ${phase.name}`}><p>{phase.objective}</p><p>{phase.recommendedDuration} · {phase.intensityGuidance}</p></Card>)}
      <p>Required Trainer skills: {data.version.requiredSkills.map((skill) => skill.name).join(', ') || 'None specified'}</p>
    </div>}
    <Modal open={!!confirm} title={confirm === 'archive' ? 'Archive template?' : 'Duplicate template'} dismissible={!busy} onClose={() => { if (!busy) setConfirm(undefined); }} footer={<><Button variant="secondary" disabled={busy} onClick={() => setConfirm(undefined)}>Cancel</Button><Button disabled={busy || confirm === 'duplicate' && !name.trim()} onClick={() => void action()}>{confirm === 'archive' ? 'Confirm archive' : 'Create duplicate'}</Button></>}>
      {error && <AlertBanner type="danger" title="Operation not confirmed">{error}</AlertBanner>}
      {confirm === 'duplicate' ? <TextField label="Duplicate template name" required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} /> : <p>Archive removes this template from new program selection. Existing programs and version history remain available.</p>}
    </Modal>
  </Drawer>;
}

function TemplateEditor({ api, initial, onClose, onSaved }: { api: Api; initial?: TemplateDetail; onClose: () => void; onSaved: (detail: TemplateDetail) => void }) {
  const [input, setInput] = useState(() => templateInput(initial?.version)), [discard, setDiscard] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [starting] = useState(() => JSON.stringify(templateInput(initial?.version)));
  const loadSpecializations = useCallback((signal: AbortSignal) => api.trainerSpecializations(signal), [api]);
  const specializations = useResource(loadSpecializations);
  const skills = [...new Map([...(initial?.version.requiredSkills ?? []), ...(specializations.data ?? [])].map((skill) => [skill.id, skill])).values()];
  const pending = useRef(false), formId = useId();
  const dirty = JSON.stringify(input) !== starting;
  const fields = [
    ['goals', 'Goals', 2000], ['suitableHorseProfile', 'Suitable horse profile', 1000], ['recommendedDistanceUseCase', 'Distance / use case guidance', 500], ['recommendedDuration', 'Recommended duration', 100], ['workloadIntensityGuidance', 'Workload & intensity guidance', 1000], ['preferredSurfaces', 'Preferred surfaces', 500], ['recoveryGuidance', 'Recovery guidance', 1000],
  ] as const;
  const set = (key: keyof Omit<TemplateInput, 'phases' | 'requiredSkillIds'>, value: string) => setInput((previous) => ({ ...previous, [key]: value }));
  async function save() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { const body = { ...input, name: input.name.trim(), phases: input.phases.map((phase, index) => ({ ...phase, phaseOrder: index + 1, name: phase.name.trim() })) };
      const result = initial ? await api.version(initial.template.id, body) : await api.create(body); onSaved(result); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <><UnsavedChangesGuard dirty={dirty || busy} /><Modal open size="lg" title={initial ? 'Save New Template Version' : 'Create Program Template'} dismissible={!dirty && !busy} onClose={onClose} footer={<><Button variant="secondary" disabled={busy} onClick={() => dirty ? setDiscard(true) : onClose()}>Cancel</Button><Button type="submit" form={formId} disabled={busy}>{busy ? 'Saving…' : initial ? 'Save New Version' : 'Save Template'}</Button></>}>
    <form id={formId} className={styles.stack} onSubmit={(event) => { event.preventDefault(); void save(); }}>
      {error && <AlertBanner type="danger" title="Template not confirmed saved">{error} Your draft is kept.</AlertBanner>}
      <TextField label="Template name" required maxLength={150} value={input.name} disabled={busy} onChange={(event) => set('name', event.target.value)} />
      <div className={styles.fields}>{fields.map(([key, label, max]) => <TextAreaField key={key} label={label} maxLength={max} value={input[key] ?? ''} disabled={busy} onChange={(event) => set(key, event.target.value)} />)}</div>
      <fieldset disabled={busy} className={styles.stack}><legend>Required Trainer specializations</legend>
        {specializations.pending && <LoadingState label="Loading Trainer specializations…" />}
        {specializations.error && <ErrorState title="Trainer specializations unavailable" description={specializations.error} onRetry={specializations.reload} />}
        {skills.map((skill) => <Checkbox key={skill.id} label={skill.name} checked={input.requiredSkillIds.includes(skill.id)} onChange={(event) => setInput((previous) => ({ ...previous, requiredSkillIds: event.target.checked ? [...previous.requiredSkillIds, skill.id] : previous.requiredSkillIds.filter((id) => id !== skill.id) }))} />)}
        {!specializations.pending && !specializations.error && skills.length === 0 && <EmptyState title="No Trainer specializations in the catalog" description="Add approved Trainer specializations through user management before using profile matching." />}
        {input.requiredSkillIds.length === 0 && <p>No specializations selected. This template will have no profile-matched Trainer recommendations.</p>}
      </fieldset>
      <h3>Phase structure</h3>{input.phases.map((phase, index) => <Card key={index} title={`Phase ${index + 1}`}><div className={styles.stack}>
        <TextField label={`Phase ${index + 1} name`} required maxLength={150} value={phase.name} disabled={busy} onChange={(event) => setInput((previous) => ({ ...previous, phases: previous.phases.map((item, i) => i === index ? { ...item, name: event.target.value } : item) }))} />
        {([['objective', 'Objective', 1000], ['recommendedDuration', 'Duration guidance', 100], ['intensityGuidance', 'Intensity guidance', 500]] as const).map(([key, label, max]) => <TextField key={key} label={`Phase ${index + 1} ${label}`} maxLength={max} value={phase[key] ?? ''} disabled={busy} onChange={(event) => setInput((previous) => ({ ...previous, phases: previous.phases.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item) }))} />)}
        <Button type="button" variant="secondary" disabled={busy || input.phases.length === 1} onClick={() => setInput((previous) => ({ ...previous, phases: previous.phases.filter((_, i) => i !== index) }))}>Remove phase {index + 1}</Button>
      </div></Card>)}
      <Button type="button" variant="secondary" disabled={busy} onClick={() => setInput((previous) => ({ ...previous, phases: [...previous.phases, { phaseOrder: previous.phases.length + 1, name: '' }] }))}>Add phase</Button>
    </form>
  </Modal><Modal open={discard} title="Discard template draft?" onClose={() => setDiscard(false)} footer={<><Button variant="secondary" onClick={() => setDiscard(false)}>Continue editing</Button><Button variant="destructive" onClick={onClose}>Discard draft</Button></>}><p>Unsaved template changes will be discarded.</p></Modal></>;
}
