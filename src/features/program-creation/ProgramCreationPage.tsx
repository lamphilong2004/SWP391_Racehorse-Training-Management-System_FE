import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ActionBar, AlertBanner, Button, Card, DataTable, EmptyState, ErrorState, Icon, SelectField, StatusBadge, TextField, WizardStepper } from '../../design-system';
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
import { viLabel } from '../../shared/viLabels';
import { strengthSummary } from '../horses/shared/options';
import { dateTime } from '../evaluation/models';

const STEP_NAMES = ['Ngựa', 'Hồ sơ', 'Mẫu chương trình', 'Tùy chỉnh', 'Khối lượng', 'Trainer', 'Xem lại'];
const STEP_TITLES = ['Chọn ngựa', 'Hồ sơ huấn luyện', 'Chọn mẫu chương trình', 'Tùy chỉnh chương trình', 'Khối lượng và cường độ', 'Phân công Trainer', 'Xem lại và kích hoạt'];

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
    if (step < 2 && !flow.horse) nextIssues = [{ field: 'horseId', message: 'Hãy chọn ngựa.' }];
    if (step === 2 && !flow.draft) nextIssues = [{ field: 'templateVersionId', message: 'Hãy chọn một phiên bản mẫu đang hoạt động.' }];
    if (step >= 3 && flow.draft) {
      const candidate = flow.trainers?.candidates.find((item) => item.user.id === flow.draft!.trainer.trainerUserId);
      nextIssues = validateProgramCreation(flow.draft, candidate).filter((issue) => step >= 5 || !issue.field.startsWith('trainer.'));
      if (step >= 5 && !candidate && !nextIssues.some((issue) => issue.field === 'trainer.trainerUserId')) nextIssues.push({ field: 'trainer.trainerUserId', message: 'Hãy chọn Trainer trong danh sách ứng viên hiện tại.' });
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

  return <AppShell designSystem="v2" user={{ fullName: user.fullName, role: 'HEAD_TRAINER' }} breadcrumb={[{ label: 'Chương trình huấn luyện' }, { label: 'Tạo chương trình' }]}>
    <div className={styles.page}>
      <div className={styles.heading}><div><h1 ref={heading} tabIndex={-1} className="text-h1">Tạo chương trình huấn luyện</h1>
        <p> {flow.created ? 'Đã tạo và kích hoạt chương trình' : `Bước ${step + 1}/7 · ${STEP_TITLES[step]}`}</p></div>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => navigate(ROUTES.dashboard)}>{flow.created ? 'Quay lại không gian làm việc' : 'Hủy'}</Button>
      </div>
      {flow.created ? <ProgramResult flow={{ ...flow, created: readback ?? flow.created }} reload={() => void reload()} reloading={reloading} readError={readError} /> : <>
        <WizardStepper steps={STEP_NAMES} currentStep={step} onStepClick={(next) => { if (!busy) edit(next); }} />
        {flow.horse && <div className={styles.context}><Icon name="horseshoe" /><strong>{flow.horse.name}</strong><span>{flow.horse.horseCode}</span>
          <StatusBadge family="availability" status={flow.horse.trainingAvailability} />
          {flow.template && <span>{flow.template.template.templateCode} · v{flow.template.version.versionNo}</span>}
        </div>}
        {!flow.horse && <div className={styles.context}><Icon name="horseshoe" /><span>Ngựa: chưa chọn</span></div>}
        {flow.error != null && <AlertBanner type="danger" title="Yêu cầu thất bại">{programErrorMessage(flow.error)}
          {flow.error instanceof ApiError && flow.error.details.length > 0 && <ul className={styles.reasons}>{flow.error.details.map((detail, index) => <li key={index}>{detail.message}</li>)}</ul>}
        </AlertBanner>}
        {flow.pending && <p role="status">{busy ? 'Đang tạo chương trình…' : 'Đang tải lựa chọn…'}</p>}
        {allIssues.length > 0 && <AlertBanner type="danger" title="Hãy kiểm tra các trường được đánh dấu"><ul className={styles.reasons}>{allIssues.map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}</ul></AlertBanner>}
        <form aria-label="Tạo chương trình huấn luyện" noValidate onSubmit={(event) => { event.preventDefault(); void advance(); }}>
          <fieldset disabled={busy} className={styles.formBody}>
            {step === 0 && <div className={styles.columns}><Card title="Chọn ngựa cho chương trình này"><div className={styles.stack}>
              <div className={styles.row}><TextField label="Tìm ngựa" value={horseSearch} onChange={(event) => setHorseSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setHorseQuery({ ...horseQuery, q: horseSearch, page: 0 }); } }} />
                <SelectField label="Khả năng tập luyện" value={horseQuery.availability} options={[{ value: '', label: 'Tất cả' }, ...['AVAILABLE', 'LIMITED', 'LOCKED'].map((value) => ({ value, label: viLabel(value) }))]} onChange={(event) => setHorseQuery({ ...horseQuery, page: 0, availability: event.target.value })} />
                <Button type="button" variant="secondary" onClick={() => setHorseQuery({ ...horseQuery, q: horseSearch, page: 0 })}>Tìm ngựa</Button></div>
              {horses.pending && <p role="status">Đang tải danh sách ngựa…</p>}
              {horses.error != null && <ErrorState title="Không tải được danh sách ngựa" description={programErrorMessage(horses.error)} onRetry={horses.retry} />}
              {horses.data && <div className={styles.table}><DataTable caption="Chọn một ngựa đang hoạt động" rows={horses.data.items.filter((horse) => horse.lifecycle === 'ACTIVE')} rowKey={(horse) => horse.id} selectedKey={flow.horse?.id} columns={[
                { key: 'horse', header: 'Ngựa', render: (horse) => <label className={styles.horseChoice}><input type="radio" name="program-horse" aria-label={`Chọn ${horse.name} (${horse.horseCode})`} checked={flow.horse?.id === horse.id} disabled={horse.trainingAvailability === 'LOCKED' || ['INJURED', 'QUARANTINED'].includes(horse.healthStatus ?? '')} onChange={() => { setIssues([]); setRequestedTemplate(null); void flow.selectHorse(horse); }} /><Icon name="horseshoe" /><span>{horse.name}<small className={styles.muted}>{horse.horseCode}{horse.breed ? ` · ${horse.breed}` : ''}</small></span></label> },
                { key: 'availability', header: 'Khả năng tập luyện', render: (horse) => <StatusBadge family="availability" status={horse.trainingAvailability} /> },
                { key: 'strengths', header: 'Thế mạnh (khai báo)', render: (horse) => <span className={horse.strengths?.length ? undefined : styles.muted}>{strengthSummary(horse.strengths)}</span> },
                { key: 'lastTraining', header: 'Lần tập gần nhất', render: (horse) => horse.lastTrainingAt ? dateTime(horse.lastTrainingAt) : <span className={styles.muted}>Chưa có buổi hoàn thành</span> },
                { key: 'program', header: 'Chương trình hiện tại', render: (horse) => horse.currentProgramName ?? <span className={styles.muted}>Chưa có</span> },
              ]} /></div>}
              {horses.data?.items.length === 0 && <EmptyState title="Không có ngựa đang hoạt động" description="Hãy thử từ khóa khác." />}
              {horses.data && <div className={styles.row}>
                <Button type="button" variant="tertiary" disabled={horseQuery.page === 0} onClick={() => setHorseQuery({ ...horseQuery, page: horseQuery.page - 1 })}>Ngựa trước</Button>
                <span>Trang {horseQuery.page + 1}/{Math.max(1, horses.data.totalPages)}</span>
                <Button type="button" variant="tertiary" disabled={horseQuery.page + 1 >= horses.data.totalPages} onClick={() => setHorseQuery({ ...horseQuery, page: horseQuery.page + 1 })}>Ngựa tiếp</Button>
              </div>}
              {error('horseId') && <p className={styles.error}>{error('horseId')}</p>}
            </div></Card><div className={styles.stack}><HorseSummary flow={flow} /><AvailabilityNote flow={flow} /></div></div>}
            {step === 1 && flow.horse && <ProgramProfile horse={flow.horse} />}
            {step === 2 && <div className={styles.columns}><div className={styles.stack}>
              <Card title="Mẫu chương trình được gợi ý"><div className={styles.stack}>
                {flow.recommendations.map((item) => <article className={styles.choice} key={`${item.templateId}-${item.templateVersionId}`}><h3>{item.name} · v{item.versionNo}</h3><p>{viLabel(item.label)}</p>
                  <ul className={styles.reasons}>{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  <Button type="button" variant="secondary" onClick={() => selectTemplate(item.templateId, item.versionNo)}>Dùng mẫu gợi ý {item.name}</Button>
                </article>)}
                {!flow.recommendations.length && <p>Không có gợi ý. Hãy chọn một mẫu đang hoạt động bên dưới.</p>}
              </div></Card>
              <Card title="Mẫu chương trình đang hoạt động"><div className={styles.stack}>
                <div className={styles.row}><TextField label="Tìm mẫu chương trình" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setTemplateQuery({ q: templateSearch, page: 0 }); } }} /><Button type="button" variant="secondary" onClick={() => setTemplateQuery({ q: templateSearch, page: 0 })}>Tìm mẫu chương trình</Button></div>
                {templates.pending && <p role="status">Đang tải mẫu chương trình…</p>}
                {templates.error != null && <ErrorState title="Không tải được mẫu chương trình" description={programErrorMessage(templates.error)} onRetry={templates.retry} />}
                {templates.data?.items.filter((item) => item.status === 'ACTIVE').map((item) => <article className={`${styles.choice} ${flow.template?.template.id === item.id ? styles.selected : ''}`} key={item.id}>
                  <h3>{item.name}</h3><p>{item.templateCode} · Mới nhất v{item.latestVersionNo}</p><Button type="button" variant="secondary" onClick={() => selectTemplate(item.id)}>Dùng {item.name}</Button>
                </article>)}
                {templates.data?.items.length === 0 && <EmptyState title="Không có mẫu đang hoạt động" description="Hãy thử từ khóa khác." />}
                {templates.data && <div className={styles.row}><Button type="button" variant="tertiary" disabled={templateQuery.page === 0} onClick={() => setTemplateQuery({ ...templateQuery, page: templateQuery.page - 1 })}>Mẫu trước</Button><span>Trang {templateQuery.page + 1}/{Math.max(1, templates.data.totalPages)}</span><Button type="button" variant="tertiary" disabled={templateQuery.page + 1 >= templates.data.totalPages} onClick={() => setTemplateQuery({ ...templateQuery, page: templateQuery.page + 1 })}>Mẫu tiếp</Button></div>}
                {error('templateVersionId') && <p className={styles.error}>{error('templateVersionId')}</p>}
              </div></Card>
            </div><div className={styles.stack}>
              {flow.template && <Card title="Phiên bản mẫu đã chọn"><div className={styles.stack}><p>{flow.template.version.name}</p>
                <SelectField label="Phiên bản mẫu" required options={flow.template.versions.map((version) => ({ value: String(version.versionNo), label: `Phiên bản ${version.versionNo}` }))} value={String(flow.template.version.versionNo)} onChange={(event) => selectTemplate(flow.template!.template.id, Number(event.target.value))} />
                <p className={styles.muted}>Đổi mẫu hoặc phiên bản sẽ thay thế bản nháp này và xóa Trainer đã chọn.</p>
              </div></Card>}
              {flow.error != null && requestedTemplate && <Button type="button" variant="secondary" onClick={() => selectTemplate(requestedTemplate.id, requestedTemplate.versionNo)}>Tải lại lựa chọn mẫu</Button>}
              <AlertBanner type="info" title="Mẫu chương trình không bị thay đổi">Phiên bản đã chọn được sao chép thành một chương trình riêng cho ngựa này. Gợi ý chỉ nêu lý do phù hợp, không chấm điểm.</AlertBanner>
            </div></div>}
            {step >= 3 && <DraftSteps step={step} flow={flow} issues={allIssues} update={update} edit={edit} />}
          </fieldset>
          <ActionBar leading={<span>Bước {step + 1} / 7</span>}><Button type="button" variant="secondary" disabled={step === 0 || busy} onClick={() => edit(step - 1)}>Quay lại</Button>
            <Button type="submit" disabled={Boolean(flow.pending)}>{busy ? 'Đang tạo chương trình…' : step === 6 ? 'Tạo và kích hoạt chương trình' : 'Tiếp tục'}</Button>
          </ActionBar>
        </form>
      </>}
    </div>
  </AppShell>;
}
