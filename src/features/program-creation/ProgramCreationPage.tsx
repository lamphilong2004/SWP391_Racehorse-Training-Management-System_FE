import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, Icon, SelectField, StatusBadge, TextField, WizardStepper } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { ROUTES } from '../../app/routePaths';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import { validateProgramCreation, type ProgramValidationIssue } from './programDraft';
import { programErrorMessage, stepForField } from './programErrors';
import { useProgramCreation } from './useProgramCreation';
import { useProgramCreationApi } from './programTransport';
import { useProgramLookup } from './useProgramLookup';
import { AvailabilityNote, DraftSteps, HorseSummary, ProgramResult } from './ProgramSteps';
import type { CreateProgramRequest, ProgramDetail } from './programTypes';
import styles from './ProgramCreationPage.module.css';
import { ProgramProfile } from './ProgramProfile';

const STEP_NAMES = ['Horse', 'Profile', 'Template', 'Customize', 'Workload', 'Trainer', 'Review'];
const STEP_TITLES = ['Select horse', 'Training profile', 'Choose template', 'Customize program', 'Workload and intensity', 'Assign Trainer', 'Review and activate'];

export function ProgramCreationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const api = useProgramCreationApi();
  const flow = useProgramCreation(api);
  const [step, setStep] = useState(0);
  const [issues, setIssues] = useState<ProgramValidationIssue[]>([]);
  const [horseSearch, setHorseSearch] = useState('');
  const [horseQuery, setHorseQuery] = useState({ q: '', page: 0, availability: '' });
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateQuery, setTemplateQuery] = useState({ q: '', page: 0 });
  const [requestedTemplate, setRequestedTemplate] = useState<{ id: number; versionNo?: number } | null>(null);
  const [readback, setReadback] = useState<ProgramDetail | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const readPending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const loadHorses = useCallback((signal: AbortSignal) => api.listHorses(horseQuery, signal), [api, horseQuery]);
  const loadTemplates = useCallback((signal: AbortSignal) => api.listTemplates(templateQuery, signal), [api, templateQuery]);
  const horses = useProgramLookup(loadHorses);
  const templates = useProgramLookup(loadTemplates);
  useEffect(() => { heading.current?.focus(); }, [step, flow.created, flow.error, flow.issues.length, issues.length]);
  if (!user) return null;

  const allIssues = [...issues, ...flow.issues];
  const error = (field: string) => allIssues.find((issue) => issue.field === field)?.message;
  const busy = flow.pending === 'create';
  const edit = (next: number) => { setIssues([]); setStep(next); };
  const update = (patch: Partial<Omit<CreateProgramRequest, 'horseId' | 'templateVersionId'>>) => { setIssues([]); flow.updateDraft(patch); };
  const selectTemplate = (id: number, versionNo?: number) => {
    setIssues([]); setRequestedTemplate({ id, versionNo });
    void flow.selectTemplate(id, versionNo);
  };
  const advance = async () => {
    if (flow.pending) return;
    let nextIssues: ProgramValidationIssue[] = [];
    if (step < 2 && !flow.horse) nextIssues = [{ field: 'horseId', message: 'Select a horse.' }];
    if (step === 2 && !flow.draft) nextIssues = [{ field: 'templateVersionId', message: 'Select an ACTIVE template version.' }];
    if (step >= 3 && flow.draft) {
      const candidate = flow.trainers?.candidates.find((item) => item.user.id === flow.draft!.trainer.trainerUserId);
      nextIssues = validateProgramCreation(flow.draft, candidate).filter((issue) => step >= 5 || !issue.field.startsWith('trainer.'));
      if (step >= 5 && !candidate && !nextIssues.some((issue) => issue.field === 'trainer.trainerUserId')) nextIssues.push({ field: 'trainer.trainerUserId', message: 'Select a Trainer from the current candidates.' });
    }
    setIssues(nextIssues);
    if (nextIssues.length) return;
    if (step < 6) setStep(step + 1);
    else {
      const outcome = await flow.submit();
      if (outcome && outcome.kind !== 'created' && outcome.issues.length) setStep(stepForField(outcome.issues[0].field));
    }
  };
  const reload = async () => {
    if (!flow.created || readPending.current) return;
    readPending.current = true; setReloading(true); setReadError(null);
    try { setReadback(await api.read(flow.created.id)); }
    catch (error) { setReadError(programErrorMessage(error)); }
    finally { readPending.current = false; setReloading(false); }
  };

  return <AppShell user={{ fullName: user.fullName, role: 'HEAD_TRAINER' }} breadcrumb={[{ label: 'Training Programs' }, { label: 'Create Program' }]}>
    <div className={styles.page}>
      <div className={styles.heading}><div><h1 ref={heading} tabIndex={-1} className="text-h1">Create Training Program</h1>
        <p> {flow.created ? 'Program created and activated' : `Step ${step + 1} of 7 · ${STEP_TITLES[step]}`}</p></div>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => navigate(ROUTES.dashboard)}>{flow.created ? 'Back to workspace' : 'Cancel'}</Button>
      </div>
      {flow.created ? <ProgramResult flow={{ ...flow, created: readback ?? flow.created }} reload={() => void reload()} reloading={reloading} readError={readError} /> : <>
        <WizardStepper steps={STEP_NAMES} currentStep={step} onStepClick={(next) => { if (!busy) edit(next); }} />
        {flow.horse && <div className={styles.context}><Icon name="horseshoe" /><strong>{flow.horse.name}</strong><span>{flow.horse.horseCode}</span>
          <StatusBadge family="availability" status={flow.horse.trainingAvailability} />
          {flow.template && <span>{flow.template.template.templateCode} · v{flow.template.version.versionNo}</span>}
        </div>}
        {!flow.horse && <div className={styles.context}><Icon name="horseshoe" /><span>Horse: not selected yet</span></div>}
        {flow.error != null && <AlertBanner type="danger" title="Request failed">{programErrorMessage(flow.error)}
          {flow.error instanceof ApiError && flow.error.details.length > 0 && <ul className={styles.reasons}>{flow.error.details.map((detail, index) => <li key={index}>{detail.message}</li>)}</ul>}
        </AlertBanner>}
        {flow.pending && <p role="status">{busy ? 'Creating program…' : 'Loading selection…'}</p>}
        {allIssues.length > 0 && <AlertBanner type="danger" title="Check the highlighted fields"><ul className={styles.reasons}>{allIssues.map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}</ul></AlertBanner>}
        <form aria-label="Create training program" noValidate onSubmit={(event) => { event.preventDefault(); void advance(); }}>
          <fieldset disabled={busy} className={styles.formBody}>
            {step === 0 && <div className={styles.columns}><Card title="Select a horse for this program"><div className={styles.stack}>
              <div className={styles.row}><TextField label="Search horses" value={horseSearch} onChange={(event) => setHorseSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setHorseQuery({ ...horseQuery, q: horseSearch, page: 0 }); } }} />
                <SelectField label="Availability" value={horseQuery.availability} options={[{ value: '', label: 'All' }, ...['AVAILABLE', 'LIMITED', 'LOCKED'].map((value) => ({ value, label: value }))]} onChange={(event) => setHorseQuery({ ...horseQuery, page: 0, availability: event.target.value })} />
                <Button type="button" variant="secondary" onClick={() => setHorseQuery({ ...horseQuery, q: horseSearch, page: 0 })}>Search horses</Button></div>
              <div className={styles.fields}><SelectField label="Breed" disabled options={[{ value: '', label: 'All breeds' }]} helperText="Breed filtering is unavailable in the approved list contract." /><SelectField label="Stable" disabled options={[{ value: '', label: 'All stables' }]} helperText="Stable filtering is unavailable in the approved list contract." /></div>
              {horses.pending && <p role="status">Loading horses…</p>}
              {horses.error != null && <ErrorState title="Horses unavailable" description={programErrorMessage(horses.error)} onRetry={horses.retry} />}
              {horses.data && <div className={styles.table}><DataTable caption="Select an ACTIVE horse" rows={horses.data.items.filter((horse) => horse.lifecycle === 'ACTIVE')} rowKey={(horse) => horse.id} selectedKey={flow.horse?.id} columns={[
                { key: 'horse', header: 'Horse', render: (horse) => <label className={styles.horseChoice}><input type="radio" name="program-horse" aria-label={`Select ${horse.name}`} checked={flow.horse?.id === horse.id} disabled={horse.trainingAvailability === 'LOCKED'} onChange={() => { setIssues([]); setRequestedTemplate(null); void flow.selectHorse(horse); }} /><Icon name="horseshoe" /><span>{horse.name}<small className={styles.muted}>{horse.horseCode}{horse.breed ? ` · ${horse.breed}` : ''}</small></span></label> },
                { key: 'availability', header: 'Availability', render: (horse) => <StatusBadge family="availability" status={horse.trainingAvailability} /> },
                { key: 'lastTraining', header: 'Last training', render: () => <span className={styles.muted}>Not provided</span> },
                { key: 'program', header: 'Current program', render: () => <span className={styles.muted}>Not provided</span> },
              ]} /></div>}
              {horses.data?.items.length === 0 && <EmptyState title="No ACTIVE horses" description="Try a different search." />}
              {horses.data && <div className={styles.row}>
                <Button type="button" variant="tertiary" disabled={horseQuery.page === 0} onClick={() => setHorseQuery({ ...horseQuery, page: horseQuery.page - 1 })}>Previous horses</Button>
                <span>Page {horseQuery.page + 1} of {Math.max(1, horses.data.totalPages)}</span>
                <Button type="button" variant="tertiary" disabled={horseQuery.page + 1 >= horses.data.totalPages} onClick={() => setHorseQuery({ ...horseQuery, page: horseQuery.page + 1 })}>Next horses</Button>
              </div>}
              {error('horseId') && <p className={styles.error}>{error('horseId')}</p>}
            </div></Card><div className={styles.stack}><HorseSummary flow={flow} /><AvailabilityNote flow={flow} /></div></div>}
            {step === 1 && flow.horse && <ProgramProfile horse={flow.horse} />}
            {step === 2 && <div className={styles.columns}><div className={styles.stack}>
              <Card title="Recommended templates"><div className={styles.stack}>
                {flow.recommendations.map((item) => <article className={styles.choice} key={`${item.templateId}-${item.templateVersionId}`}><h3>{item.name} · v{item.versionNo}</h3><p>{item.label.replaceAll('_', ' ')}</p>
                  <ul className={styles.reasons}>{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  <Button type="button" variant="secondary" onClick={() => selectTemplate(item.templateId, item.versionNo)}>Use recommended {item.name}</Button>
                </article>)}
                {!flow.recommendations.length && <p>No recommendations returned. Choose an ACTIVE template below.</p>}
              </div></Card>
              <Card title="ACTIVE templates"><div className={styles.stack}>
                <div className={styles.row}><TextField label="Search templates" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setTemplateQuery({ q: templateSearch, page: 0 }); } }} /><Button type="button" variant="secondary" onClick={() => setTemplateQuery({ q: templateSearch, page: 0 })}>Search templates</Button></div>
                {templates.pending && <p role="status">Loading templates…</p>}
                {templates.error != null && <ErrorState title="Templates unavailable" description={programErrorMessage(templates.error)} onRetry={templates.retry} />}
                {templates.data?.items.filter((item) => item.status === 'ACTIVE').map((item) => <article className={`${styles.choice} ${flow.template?.template.id === item.id ? styles.selected : ''}`} key={item.id}>
                  <h3>{item.name}</h3><p>{item.templateCode} · Latest v{item.latestVersionNo}</p><Button type="button" variant="secondary" onClick={() => selectTemplate(item.id)}>Use {item.name}</Button>
                </article>)}
                {templates.data?.items.length === 0 && <EmptyState title="No ACTIVE templates" description="Try a different search." />}
                {templates.data && <div className={styles.row}><Button type="button" variant="tertiary" disabled={templateQuery.page === 0} onClick={() => setTemplateQuery({ ...templateQuery, page: templateQuery.page - 1 })}>Previous templates</Button><span>Page {templateQuery.page + 1} of {Math.max(1, templates.data.totalPages)}</span><Button type="button" variant="tertiary" disabled={templateQuery.page + 1 >= templates.data.totalPages} onClick={() => setTemplateQuery({ ...templateQuery, page: templateQuery.page + 1 })}>Next templates</Button></div>}
                {error('templateVersionId') && <p className={styles.error}>{error('templateVersionId')}</p>}
              </div></Card>
            </div><div className={styles.stack}>
              {flow.template && <Card title="Pinned template version"><div className={styles.stack}><p>{flow.template.version.name}</p>
                <SelectField label="Template version" required options={flow.template.versions.map((version) => ({ value: String(version.versionNo), label: `Version ${version.versionNo}` }))} value={String(flow.template.version.versionNo)} onChange={(event) => selectTemplate(flow.template!.template.id, Number(event.target.value))} />
                <p className={styles.muted}>Changing the template or version replaces this draft and clears its Trainer selection.</p>
              </div></Card>}
              {flow.error != null && requestedTemplate && <Button type="button" variant="secondary" onClick={() => selectTemplate(requestedTemplate.id, requestedTemplate.versionNo)}>Retry template selection</Button>}
              <AlertBanner type="info" title="Templates stay unchanged">The selected version is copied into a separate program for this horse. Recommendations show suitability reasons without scores.</AlertBanner>
            </div></div>}
            {step >= 3 && <DraftSteps step={step} flow={flow} issues={allIssues} update={update} edit={edit} />}
          </fieldset>
          <div className={styles.footer}><Button type="button" variant="secondary" disabled={step === 0 || busy} onClick={() => edit(step - 1)}>Back</Button>
            <Button type="submit" disabled={Boolean(flow.pending)}>{busy ? 'Creating program…' : step === 6 ? 'Create and activate program' : 'Continue'}</Button>
          </div>
        </form>
      </>}
    </div>
  </AppShell>;
}
