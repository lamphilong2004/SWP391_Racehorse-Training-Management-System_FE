import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ActionBar, AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, Icon, SelectField, StatusBadge, TextField, WizardStepper, focusFirstInvalid } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { ROUTES } from '../../app/routePaths';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import { validateProgramCreation, type ProgramValidationIssue } from './programDraft';
import { programErrorMessage, stepForField } from './programErrors';
import { useProgramCreation } from './useProgramCreation';
import { useProgramCreationApi } from './programTransport';
import { useProgramLookup } from './useProgramLookup';
import { DraftSteps, ProgramResult } from './ProgramSteps';
import type { CreateProgramRequest, HorseSelection, ProgramDetail } from './programTypes';
import styles from './ProgramCreationPage.module.css';
import { ProgramProfile } from './ProgramProfile';
import { viLabel } from '../../shared/viLabels';
import { strengthSummary } from '../horses/shared/options';
import { dateTime } from '../evaluation/models';
import { HorsePhotoImage } from '../horses/shared/HorsePhotoImage';
import { businessDataMode } from '../../shared/data/businessData';
import { serverText } from '../../shared/serverText';

const STEP_NAMES = ['Ngựa', 'Hồ sơ', 'Mẫu chương trình', 'Tùy chỉnh', 'Khối lượng', 'Trainer', 'Xem lại'];
const STEP_TITLES = ['Chọn ngựa', 'Hồ sơ huấn luyện', 'Chọn mẫu chương trình', 'Tùy chỉnh chương trình', 'Khối lượng và cường độ', 'Phân công Trainer', 'Xem lại và kích hoạt'];
const blockingHealthStatus = ({ healthStatus }: HorseSelection) =>
  healthStatus === 'INJURED' || healthStatus === 'QUARANTINED' ? healthStatus : null;
const canSelectHorse = (horse: HorseSelection) => horse.lifecycle === 'ACTIVE'
  && horse.trainingAvailability !== 'LOCKED' && !blockingHealthStatus(horse);

export function ProgramCreationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const api = useProgramCreationApi();
  const flow = useProgramCreation(api);
  const [step, setStep] = useState(0);
  const [issues, setIssues] = useState<ProgramValidationIssue[]>([]);
  const [horseSearch, setHorseSearch] = useState('');
  // 10 horses per page in a plain table (Leader request 11/11), no inner scroll area.
  const [horseQuery, setHorseQuery] = useState({ q: '', page: 0, size: 10, availability: '' });
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateQuery, setTemplateQuery] = useState({ q: '', page: 0 });
  const [browseTemplates, setBrowseTemplates] = useState(false);
  const [requestedTemplate, setRequestedTemplate] = useState<{ id: number; versionNo?: number } | null>(null);
  const [readback, setReadback] = useState<ProgramDetail | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const readPending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const loadHorses = useCallback((signal: AbortSignal) => api.listHorses(horseQuery, signal), [api, horseQuery]);
  const loadTemplates = useCallback((signal: AbortSignal) => api.listTemplates({ ...templateQuery, size: 6 }, signal), [api, templateQuery]);
  const horses = useProgramLookup(loadHorses);
  const templates = useProgramLookup(loadTemplates);
  useEffect(() => { heading.current?.focus(); }, [step, flow.created]);
  useEffect(() => {
    if (issues.length || flow.issues.length) focusFirstInvalid(form.current);
  }, [step, issues, flow.issues]);
  if (!user) return null;

  const allIssues = [...issues, ...flow.issues];
  const issueMessages = [...new Set(allIssues.map((issue) => issue.message))];
  const showCatalog = browseTemplates || flow.recommendations.length === 0;
  const error = (field: string) => allIssues.find((issue) => issue.field === field)?.message;
  const renderTemplate = (id: number, name: string, versionNo: number, recommendation?: (typeof flow.recommendations)[number], goals?: string | null) => {
    const selected = flow.template?.template.id === id ? flow.template : null;
    return <article className={styles.templateOption} data-selected={Boolean(selected)} key={recommendation?.templateVersionId ?? id}>
      <header className={styles.templateHeader}>
        <span className={styles.templateIcon}><Icon name="clipboard-list" size={21} /></span>
        {selected ? <span className={styles.templateSelected}><Icon name="check-circle" size={16} /> Đã chọn</span>
          : <span className={styles.templateVersion}>{recommendation ? viLabel(recommendation.label) : 'Thư viện mẫu'}</span>}
      </header>
      <div className={styles.templateIdentity}><h3>{name}</h3><p className={styles.templateVersion}>Phiên bản {selected?.version.versionNo ?? versionNo}</p></div>
      {recommendation?.reasons[0] && <div className={styles.templateReason}>
        <p>{serverText(recommendation.reasons[0])}</p>
        {recommendation.reasons.length > 1 && <details><summary>Lý do khác</summary><ul className={styles.reasons}>{recommendation.reasons.slice(1).map((reason) => <li key={reason}>{serverText(reason)}</li>)}</ul></details>}
      </div>}
      {!recommendation && goals && <p className={styles.templateReason}>{serverText(goals)}</p>}
      {selected ? selected.versions.length > 1 && <SelectField label="Phiên bản mẫu" required options={selected.versions.map((version) => ({ value: String(version.versionNo), label: `Phiên bản ${version.versionNo}` }))} value={String(selected.version.versionNo)}
          onChange={(event) => selectTemplate(id, Number(event.target.value))} />
        : <button className={styles.pickTemplate} type="button" disabled={flow.pending === 'template'}
            aria-label={`${recommendation ? 'Dùng mẫu gợi ý' : 'Dùng'} ${name}`} onClick={() => selectTemplate(id, recommendation?.versionNo)}>
          Chọn mẫu <span aria-hidden="true">→</span>
        </button>}
    </article>;
  };
  const busy = flow.pending === 'create';
  const edit = (next: number) => { setIssues([]); setStep(next); };
  const update = (patch: Partial<Omit<CreateProgramRequest, 'horseId' | 'templateVersionId'>>) => { setIssues([]); flow.updateDraft(patch); };
  const selectTemplate = (id: number, versionNo?: number) => {
    setIssues([]); setRequestedTemplate({ id, versionNo });
    void flow.selectTemplate(id, versionNo);
  };
  const chooseHorse = (horse: HorseSelection) => {
    if (!canSelectHorse(horse) || flow.horse?.id === horse.id) return;
    setIssues([]); setRequestedTemplate(null); setBrowseTemplates(false);
    void flow.selectHorse(horse);
  };
  const advance = async () => {
    if (flow.pending) return;
    let nextIssues: ProgramValidationIssue[] = [];
    if (step < 2 && !flow.horse) nextIssues = [{ field: 'horseId', message: 'Hãy chọn ngựa.' }];
    if (step === 2 && !flow.draft) nextIssues = [{ field: 'templateVersionId', message: 'Hãy chọn một phiên bản mẫu đang hoạt động.' }];
    if (step >= 3 && flow.draft) {
      const candidate = flow.trainers?.candidates.find((item) => item.user.id === flow.draft!.trainer.trainerUserId);
      nextIssues = validateProgramCreation(flow.draft, candidate).filter((issue) => step >= 5 || !issue.field.startsWith('trainer.'));
      if (step >= 5 && !candidate && !nextIssues.some((issue) => issue.field === 'trainer.trainerUserId')) nextIssues.push({ field: 'trainer.trainerUserId', message: 'Hãy chọn Trainer trong danh sách ứng viên hiện tại.' });
    }
    setIssues(nextIssues);
    if (nextIssues.length) {
      const issueStep = stepForField(nextIssues[0].field);
      if (issueStep < step) setStep(issueStep);
      return;
    }
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

  return <AppShell designSystem="v2" user={{ fullName: user.fullName, role: 'HEAD_TRAINER' }} breadcrumb={[{ label: 'Chương trình huấn luyện' }, { label: 'Tạo chương trình' }]}>
    <div className={styles.page}>
      <div data-page-banner className={styles.heading}><div><h1 ref={heading} tabIndex={-1} className="text-h1">Tạo chương trình huấn luyện</h1>
        <p> {flow.created ? 'Đã tạo và kích hoạt chương trình' : `Bước ${step + 1}/7 · ${STEP_TITLES[step]}`}</p></div>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => navigate(ROUTES.dashboard)}>{flow.created ? 'Quay lại không gian làm việc' : 'Hủy'}</Button>
      </div>
      {flow.created ? <ProgramResult flow={{ ...flow, created: readback ?? flow.created }} reload={() => void reload()} reloading={reloading} readError={readError} /> : <>
        <WizardStepper steps={STEP_NAMES} currentStep={step} onStepClick={(next) => { if (!busy) edit(next); }} />
        {step !== 0 && flow.horse && <div className={styles.context}><Icon name="horseshoe" /><strong>{flow.horse.name}</strong><span>{flow.horse.horseCode}</span>
          <StatusBadge family="availability" status={flow.horse.trainingAvailability} />
          {step !== 2 && flow.template && <span>{flow.template.version.name} · v{flow.template.version.versionNo}</span>}
        </div>}
        {flow.error != null && <AlertBanner feedback type="danger" title="Yêu cầu thất bại">{programErrorMessage(flow.error)}
          {flow.error instanceof ApiError && flow.error.details.length > 0 && <ul className={styles.reasons}>{[...new Set(flow.error.details.map((detail) => detail.message))].map((message) => <li key={message}>{message}</li>)}</ul>}
        </AlertBanner>}
        {flow.pending && <p role="status">{busy ? 'Đang tạo chương trình…' : 'Đang tải lựa chọn…'}</p>}
        {issueMessages.length > 0 && <AlertBanner feedback type="danger" title="Hãy kiểm tra các trường được đánh dấu"><ul className={styles.reasons}>{issueMessages.map((message) => <li key={message}>{message}</li>)}</ul></AlertBanner>}
        <form ref={form} aria-label="Tạo chương trình huấn luyện" noValidate onSubmit={(event) => { event.preventDefault(); void advance(); }}>
          <fieldset disabled={busy} className={step === 0 ? `${styles.formBody} ${styles.horseStep}` : styles.formBody}>
            {step === 0 && <Card title="Chọn ngựa cho chương trình này"><div className={styles.stack}>
              <p className={styles.muted}>Bấm vào dòng ngựa để chọn. Ngựa bị khóa tập luyện, chấn thương hoặc cách ly chưa thể được chọn.</p>
              <div className={styles.horseFilters}><TextField label="Tìm ngựa" value={horseSearch} onChange={(event) => setHorseSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setHorseQuery({ ...horseQuery, q: horseSearch, page: 0 }); } }} />
                <SelectField label="Hạn chế tập luyện" value={horseQuery.availability} options={[{ value: '', label: 'Tất cả' }, { value: 'AVAILABLE', label: 'Không có hạn chế đang áp dụng' }, ...['LIMITED', 'LOCKED'].map((value) => ({ value, label: viLabel(value) }))]} onChange={(event) => setHorseQuery({ ...horseQuery, page: 0, availability: event.target.value })} />
                <Button type="button" variant="secondary" onClick={() => setHorseQuery({ ...horseQuery, q: horseSearch, page: 0 })}>Tìm ngựa</Button></div>
              {horses.pending && <p role="status">Đang tải danh sách ngựa…</p>}
              {horses.error != null && <ErrorState title="Không tải được danh sách ngựa" description={programErrorMessage(horses.error)} onRetry={horses.retry} />}
              {horses.data && <div className={`${styles.table} ${styles.horseTable}`}><DataTable caption="Chọn một ngựa đang hoạt động" rows={horses.data.items.filter((horse) => horse.lifecycle === 'ACTIVE')} rowKey={(horse) => horse.id} selectedKey={flow.horse?.id}
                onRowClick={chooseHorse} isRowClickable={canSelectHorse} focusableRows={false} columns={[
                { key: 'horse', header: 'Ngựa', render: (horse) => <div className={styles.horseChoice}>
                  {businessDataMode() === 'api' ? <HorsePhotoImage thumbnail name={horse.name} path={`/api/horses/${horse.id}/photos/primary`} /> : <Icon name="horseshoe" size={24} />}
                  <label>
                    <input type="radio" name="program-horse" aria-label={`Chọn ${horse.name} (${horse.horseCode})`}
                      checked={flow.horse?.id === horse.id} disabled={!canSelectHorse(horse)} onChange={() => chooseHorse(horse)} />
                    <strong>{horse.name}</strong>
                    <small className={styles.muted}>{horse.horseCode}{horse.breed ? ` · ${horse.breed}` : ''}</small>
                    {flow.horse?.id === horse.id && <small className={styles.chosenHorse}>Đã chọn</small>}
                  </label>
                </div> },
                { key: 'availability', header: 'Khả năng tập luyện', render: (horse) => {
                  const health = blockingHealthStatus(horse);
                  return health ? <div><StatusBadge family="health" status={health} /><div className={styles.muted}>Chưa thể tập luyện</div></div>
                    : <StatusBadge family="availability" status={horse.trainingAvailability} />;
                } },
                { key: 'strengths', header: 'Thế mạnh (khai báo)', render: (horse) => <span className={horse.strengths?.length ? undefined : styles.muted}>{strengthSummary(horse.strengths)}</span> },
                { key: 'lastTraining', header: 'Lần tập gần nhất', render: (horse) => horse.lastTrainingAt ? dateTime(horse.lastTrainingAt) : <span className={styles.muted}>Chưa có buổi hoàn thành</span> },
                { key: 'program', header: 'Chương trình hiện tại', render: (horse) => horse.currentProgramName ?? <span className={styles.muted}>Chưa có</span> },
              ]} /></div>}
              {horses.data?.items.length === 0 && <EmptyState title="Không có ngựa đang hoạt động" description="Hãy thử từ khóa khác." />}
              {horses.data && horses.data.totalPages > 1 && <div className={styles.row}>
                <Button type="button" variant="tertiary" disabled={horseQuery.page === 0} onClick={() => setHorseQuery({ ...horseQuery, page: horseQuery.page - 1 })}>Ngựa trước</Button>
                <span>Trang {horseQuery.page + 1}/{Math.max(1, horses.data.totalPages)}</span>
                <Button type="button" variant="tertiary" disabled={horseQuery.page + 1 >= horses.data.totalPages} onClick={() => setHorseQuery({ ...horseQuery, page: horseQuery.page + 1 })}>Ngựa tiếp</Button>
              </div>}
              {error('horseId') && <p className={styles.error}>{error('horseId')}</p>}
            </div></Card>}
            {step === 1 && flow.horse && <ProgramProfile horse={flow.horse} />}
            {step === 2 && <Card title="Chọn mẫu chương trình"><div className={styles.stack}>
              {flow.recommendations.length > 0 && <div className={styles.templateTabs} role="group" aria-label="Nguồn mẫu chương trình">
                <Button type="button" variant={showCatalog ? 'secondary' : 'primary'} aria-pressed={!showCatalog} onClick={() => setBrowseTemplates(false)}>Gợi ý cho ngựa</Button>
                <Button type="button" variant={showCatalog ? 'primary' : 'secondary'} aria-pressed={showCatalog} onClick={() => setBrowseTemplates(true)}>Tất cả mẫu</Button>
              </div>}
              {showCatalog ? <>
                <div className={styles.templateSearch}><TextField label="Tìm mẫu chương trình" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setTemplateQuery({ q: templateSearch, page: 0 }); } }} /><Button type="button" variant="secondary" onClick={() => setTemplateQuery({ q: templateSearch, page: 0 })}>Tìm mẫu chương trình</Button></div>
                {templates.pending && <p role="status">Đang tải mẫu chương trình…</p>}
                {templates.error != null && <ErrorState title="Không tải được mẫu chương trình" description={programErrorMessage(templates.error)} onRetry={templates.retry} />}
                <div className={styles.templateGrid}>{templates.data?.items.filter((item) => item.status === 'ACTIVE').map((item) => renderTemplate(item.id, item.name, item.latestVersionNo, undefined, item.goals))}</div>
                {templates.data?.items.length === 0 && <EmptyState title="Không có mẫu đang hoạt động" description="Hãy thử từ khóa khác." />}
                {templates.data && templates.data.totalPages > 1 && <div className={styles.row}><Button type="button" variant="tertiary" disabled={templateQuery.page === 0} onClick={() => setTemplateQuery({ ...templateQuery, page: templateQuery.page - 1 })}>Mẫu trước</Button><span>Trang {templateQuery.page + 1}/{Math.max(1, templates.data.totalPages)}</span><Button type="button" variant="tertiary" disabled={templateQuery.page + 1 >= templates.data.totalPages} onClick={() => setTemplateQuery({ ...templateQuery, page: templateQuery.page + 1 })}>Mẫu tiếp</Button></div>}
              </> : <div className={styles.templateGrid}>{flow.recommendations.slice(0, 6).map((item) => renderTemplate(item.templateId, item.name, item.versionNo, item))}</div>}
              {flow.template && <p className={styles.muted}>Đổi mẫu hoặc phiên bản sẽ thay thế bản nháp và lựa chọn Trainer.</p>}
              {error('templateVersionId') && <p className={styles.error}>{error('templateVersionId')}</p>}
              {flow.error != null && requestedTemplate && <Button type="button" variant="secondary" onClick={() => selectTemplate(requestedTemplate.id, requestedTemplate.versionNo)}>Tải lại lựa chọn mẫu</Button>}
            </div></Card>}
            {step >= 3 && <DraftSteps step={step} flow={flow} issues={allIssues} update={update} edit={edit} />}
          </fieldset>
          <ActionBar className={step === 0 ? styles.horseActions : undefined}
            leading={<span role="status">{step === 0 ? flow.horse ? `Đã chọn ${flow.horse.name} · ${flow.horse.horseCode}` : 'Chọn một ngựa để tiếp tục' : step === 2 && flow.template ? `${flow.template.version.name} · v${flow.template.version.versionNo}` : `Bước ${step + 1} / 7 · ${STEP_TITLES[step]}`}</span>}>
            {step !== 0 && <Button type="button" variant="secondary" disabled={busy} onClick={() => edit(step - 1)}>Quay lại</Button>}
            <Button type="submit" disabled={Boolean(flow.pending)}>{busy ? 'Đang tạo chương trình…' : step === 6 ? 'Tạo và kích hoạt chương trình' : 'Tiếp tục'}</Button>
          </ActionBar>
        </form>
      </>}
    </div>
  </AppShell>;
}
