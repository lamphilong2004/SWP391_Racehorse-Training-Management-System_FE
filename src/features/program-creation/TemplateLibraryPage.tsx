import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { ButtonLink, AlertBanner, Button, Card, Checkbox, Drawer, EmptyState, ErrorState, KeyValue, LoadingState, Modal, SelectField, TextAreaField, TextField, UnsavedChangesGuard } from '../../design-system';
import { errorMessage, useFlowRequest } from '../main-flows/api';
import { FlowShell } from '../main-flows/FlowShell';
import { useResource } from '../main-flows/useResource';
import type { TemplateDetail } from './programTypes';
import { createTemplateLibraryApi, templateInput, type TemplateInput } from './templateLibraryApi';
import styles from '../main-flows/flow.module.css';
import { viLabel } from '../../shared/viLabels';

type Api = ReturnType<typeof createTemplateLibraryApi>;
/** Figma Program Template Library 120:5086: filter, card grid, detail drawer, versioned editor. */
export function TemplateLibraryPage() {
  const request = useFlowRequest(), api = useMemo(() => createTemplateLibraryApi(request), [request]);
  const [status, setStatus] = useState('ACTIVE'), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number>(), [editor, setEditor] = useState<TemplateDetail | 'new'>(), [notice, setNotice] = useState('');
  const load = useCallback((signal: AbortSignal) => api.list(status, search, page, signal), [api, status, search, page]);
  const resource = useResource(load);
  return <FlowShell title="Mẫu chương trình" description="Các chiến lược huấn luyện dùng lại được. Lưu phiên bản mới không làm thay đổi chương trình của ngựa đang có." section="Huấn luyện" role="HEAD_TRAINER" actions={<Button onClick={() => setEditor('new')}>Tạo mẫu</Button>}>
    {notice && <AlertBanner type="success" title={notice} />}
    <Card><form className={styles.row} onSubmit={(event) => { event.preventDefault(); setPage(0); setSearch(query); }}>
      <TextField label="Tìm mẫu chương trình" type="search" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} />
      <SelectField label="Trạng thái mẫu" value={status} options={[{ value: 'ACTIVE', label: 'Đang hoạt động' }, { value: 'ARCHIVED', label: 'Đã lưu trữ' }]} onChange={(event) => { setStatus(event.target.value); setPage(0); }} />
      <Button type="submit" variant="secondary">Tìm kiếm</Button><ButtonLink to="/training/programs">Chương trình huấn luyện ngựa</ButtonLink>
    </form></Card>
    {resource.pending && <LoadingState label="Đang tải thư viện mẫu chương trình…" />}
    {resource.error && <ErrorState title="Không tải được thư viện mẫu" description={resource.error} onRetry={resource.reload} />}
    {resource.data && <>{resource.data.items.length === 0 ? <EmptyState title="Không tìm thấy mẫu nào" description="Hãy tạo mẫu mới hoặc đổi bộ lọc." /> : <div className={styles.fields}>{resource.data.items.map((template) => <Card key={template.id} title={template.name}><div className={styles.stack}>
      <p>{template.goals || 'Chưa có mục tiêu.'}</p><KeyValue label="Mẫu chương trình" value={template.templateCode} /><KeyValue label="Phiên bản" value={`v${template.latestVersionNo}`} /><KeyValue label="Trạng thái" value={viLabel(template.status)} />
      <Button variant="secondary" onClick={() => setSelected(template.id)}>Xem {template.name}</Button>
    </div></Card>)}</div>}
      <div className={styles.row}><Button variant="secondary" disabled={page === 0 || resource.pending} onClick={() => setPage(page - 1)}>Trước</Button><span>Trang {page + 1} · {resource.data.totalItems} mẫu</span><Button variant="secondary" disabled={page + 1 >= resource.data.totalPages || resource.pending} onClick={() => setPage(page + 1)}>Sau</Button></div>
    </>}
    {selected && <TemplateDrawer key={selected} id={selected} api={api} onClose={() => setSelected(undefined)} onEdit={(detail) => { setSelected(undefined); setEditor(detail); }} onChanged={(message) => { setSelected(undefined); setNotice(message); resource.reload(); }} />}
    {editor && <TemplateEditor key={editor === 'new' ? 'new' : `${editor.template.id}-${editor.version.versionNo}`} api={api} initial={editor === 'new' ? undefined : editor} onClose={() => setEditor(undefined)} onSaved={(detail) => { setNotice(`Đã lưu mẫu ${detail.version.name} · phiên bản ${detail.version.versionNo}`); setEditor(undefined); resource.reload(); }} />}
  </FlowShell>;
}

function TemplateDrawer({ id, api, onClose, onEdit, onChanged }: { id: number; api: Api; onClose: () => void; onEdit: (detail: TemplateDetail) => void; onChanged: (message: string) => void }) {
  const [version, setVersion] = useState<number>(), [confirm, setConfirm] = useState<'archive' | 'duplicate'>(), [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false), load = useCallback((signal: AbortSignal) => api.read(id, version, signal), [api, id, version]);
  const resource = useResource(load), data = resource.data;
  async function action() {
    if (pending.current || !data || !confirm || confirm === 'duplicate' && !name.trim()) return;
    pending.current = true; setBusy(true); setError('');
    try { if (confirm === 'archive') { await api.archive(id); onChanged('Đã lưu trữ mẫu; các chương trình của ngựa vẫn giữ phiên bản gốc.'); }
      else { await api.duplicate(id, name.trim(), data.version.versionNo); onChanged('Hệ thống đã xác nhận sao chép mẫu.'); } }
    catch (failure) { setError(errorMessage(failure)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Drawer open title={data?.version.name ?? 'Chi tiết mẫu chương trình'} subtitle={data ? `${data.template.templateCode} · v${data.version.versionNo} · ${viLabel(data.template.status)}` : undefined} onClose={busy ? () => undefined : onClose} dismissible={!busy} footer={<>
    <Button variant="secondary" disabled={busy} onClick={onClose}>Đóng</Button>{data && <><Button variant="secondary" disabled={busy} onClick={() => { setName(`${data.version.name} copy`.slice(0, 150)); setConfirm('duplicate'); }}>Sao chép</Button>{data.template.status === 'ACTIVE' && <><Button variant="secondary" disabled={busy || data.version.versionNo !== data.template.latestVersionNo} onClick={() => onEdit(data)}>Lưu phiên bản mới</Button><Button variant="destructive" disabled={busy} onClick={() => setConfirm('archive')}>Lưu trữ</Button></>}</>}
  </>}>
    {resource.pending && <LoadingState label="Đang tải mẫu…" />}{resource.error && <ErrorState title="Không tải được mẫu" description={resource.error} onRetry={resource.reload} />}
    {data && <div className={styles.stack}><SelectField label="Phiên bản mẫu" value={String(data.version.versionNo)} options={data.versions.map((item) => ({ value: String(item.versionNo), label: `Phiên bản ${item.versionNo}` }))} onChange={(event) => setVersion(Number(event.target.value))} />
      <KeyValue label="Mục tiêu" value={data.version.goals ?? 'Chưa cung cấp'} /><KeyValue label="Hồ sơ ngựa phù hợp" value={data.version.suitableHorseProfile ?? 'Chưa cung cấp'} /><KeyValue label="Thời lượng khuyến nghị" value={data.version.recommendedDuration ?? 'Chưa cung cấp'} /><KeyValue label="Mặt sân ưu tiên" value={data.version.preferredSurfaces ?? 'Chưa cung cấp'} /><KeyValue label="Hướng dẫn hồi phục" value={data.version.recoveryGuidance ?? 'Chưa cung cấp'} />
      <h3>Cấu trúc giai đoạn</h3>{data.version.phases.map((phase) => <Card key={phase.id} title={`${phase.phaseOrder}. ${phase.name}`}><p>{phase.objective}</p><p>{phase.recommendedDuration} · {phase.intensityGuidance}</p></Card>)}
      <p>Kỹ năng Trainer cần có: {data.version.requiredSkills.map((skill) => skill.name).join(', ') || 'Không yêu cầu'}</p>
    </div>}
    <Modal open={!!confirm} title={confirm === 'archive' ? 'Lưu trữ mẫu?' : 'Sao chép mẫu'} dismissible={!busy} onClose={() => { if (!busy) setConfirm(undefined); }} footer={<><Button variant="secondary" disabled={busy} onClick={() => setConfirm(undefined)}>Hủy</Button><Button disabled={busy || confirm === 'duplicate' && !name.trim()} onClick={() => void action()}>{confirm === 'archive' ? 'Xác nhận lưu trữ' : 'Tạo bản sao'}</Button></>}>
      {error && <AlertBanner type="danger" title="Chưa xác nhận được thao tác">{error}</AlertBanner>}
      {confirm === 'duplicate' ? <TextField label="Tên mẫu sao chép" required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} /> : <p>Lưu trữ sẽ ẩn mẫu này khỏi lựa chọn khi tạo chương trình mới. Các chương trình hiện có và lịch sử phiên bản vẫn còn.</p>}
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
    ['goals', 'Mục tiêu', 2000], ['suitableHorseProfile', 'Hồ sơ ngựa phù hợp', 1000], ['recommendedDistanceUseCase', 'Hướng dẫn quãng đường / mục đích', 500], ['recommendedDuration', 'Thời lượng khuyến nghị', 100], ['workloadIntensityGuidance', 'Hướng dẫn khối lượng & cường độ', 1000], ['preferredSurfaces', 'Mặt sân ưu tiên', 500], ['recoveryGuidance', 'Hướng dẫn hồi phục', 1000],
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
  return <><UnsavedChangesGuard dirty={dirty || busy} /><Modal open size="lg" title={initial ? 'Lưu phiên bản mẫu mới' : 'Tạo mẫu chương trình'} dismissible={!dirty && !busy} onClose={onClose} footer={<><Button variant="secondary" disabled={busy} onClick={() => dirty ? setDiscard(true) : onClose()}>Hủy</Button><Button type="submit" form={formId} disabled={busy}>{busy ? 'Đang lưu…' : initial ? 'Lưu phiên bản mới' : 'Lưu mẫu'}</Button></>}>
    <form id={formId} className={styles.stack} onSubmit={(event) => { event.preventDefault(); void save(); }}>
      {error && <AlertBanner type="danger" title="Chưa xác nhận lưu được mẫu">{error} Bản nháp của bạn vẫn được giữ.</AlertBanner>}
      <TextField label="Tên mẫu" required maxLength={150} value={input.name} disabled={busy} onChange={(event) => set('name', event.target.value)} />
      <div className={styles.fields}>{fields.map(([key, label, max]) => <TextAreaField key={key} label={label} maxLength={max} value={input[key] ?? ''} disabled={busy} onChange={(event) => set(key, event.target.value)} />)}</div>
      <fieldset disabled={busy} className={styles.stack}><legend>Chuyên môn Trainer cần có</legend>
        {specializations.pending && <LoadingState label="Đang tải chuyên môn của Trainer…" />}
        {specializations.error && <ErrorState title="Không tải được chuyên môn của Trainer" description={specializations.error} onRetry={specializations.reload} />}
        {skills.map((skill) => <Checkbox key={skill.id} label={skill.name} checked={input.requiredSkillIds.includes(skill.id)} onChange={(event) => setInput((previous) => ({ ...previous, requiredSkillIds: event.target.checked ? [...previous.requiredSkillIds, skill.id] : previous.requiredSkillIds.filter((id) => id !== skill.id) }))} />)}
        {!specializations.pending && !specializations.error && skills.length === 0 && <EmptyState title="Danh mục chưa có chuyên môn Trainer nào" description="Hãy thêm chuyên môn Trainer trong phần quản lý người dùng trước khi dùng tính năng ghép phù hợp." />}
        {input.requiredSkillIds.length === 0 && <p>Chưa chọn chuyên môn. Mẫu này sẽ không có gợi ý Trainer theo chuyên môn.</p>}
      </fieldset>
      <h3>Cấu trúc giai đoạn</h3>{input.phases.map((phase, index) => <Card key={index} title={`Giai đoạn ${index + 1}`}><div className={styles.stack}>
        <TextField label={`Giai đoạn ${index + 1} — tên`} required maxLength={150} value={phase.name} disabled={busy} onChange={(event) => setInput((previous) => ({ ...previous, phases: previous.phases.map((item, i) => i === index ? { ...item, name: event.target.value } : item) }))} />
        {([['objective', 'Mục tiêu', 1000], ['recommendedDuration', 'Hướng dẫn thời lượng', 100], ['intensityGuidance', 'Hướng dẫn cường độ', 500]] as const).map(([key, label, max]) => <TextField key={key} label={`Giai đoạn ${index + 1} — ${label}`} maxLength={max} value={phase[key] ?? ''} disabled={busy} onChange={(event) => setInput((previous) => ({ ...previous, phases: previous.phases.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item) }))} />)}
        <Button type="button" variant="secondary" disabled={busy || input.phases.length === 1} onClick={() => setInput((previous) => ({ ...previous, phases: previous.phases.filter((_, i) => i !== index) }))}>Xóa giai đoạn {index + 1}</Button>
      </div></Card>)}
      <Button type="button" variant="secondary" disabled={busy} onClick={() => setInput((previous) => ({ ...previous, phases: [...previous.phases, { phaseOrder: previous.phases.length + 1, name: '' }] }))}>Thêm giai đoạn</Button>
    </form>
  </Modal><Modal open={discard} title="Hủy bản nháp mẫu?" onClose={() => setDiscard(false)} footer={<><Button variant="secondary" onClick={() => setDiscard(false)}>Tiếp tục chỉnh sửa</Button><Button variant="destructive" onClick={onClose}>Hủy bản nháp</Button></>}><p>Các thay đổi chưa lưu của mẫu sẽ bị hủy.</p></Modal></>;
}
