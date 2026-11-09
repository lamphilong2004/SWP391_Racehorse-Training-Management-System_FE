import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertBanner, Button, ButtonLink, Card, Icon } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import { requestApi } from '../../shared/auth/authApi';
import { viLabel } from '../../shared/viLabels';
import { createIncidentService } from './incidentService';
import { useMedicalRuntime } from './runtimeContext';
import { medicalErrorMessage } from './errors';
import type { Incident, MedicalCase } from './models';

interface Blockers { pendingTasks: number; incidents: Incident[]; restrictions: { id: number; level: string }[] }

/**
 * The closure rules of MedicalService.requireClosureConditions as a checklist, each unmet rule with the action that
 * meets it, so the Veterinarian is not left with "Cần xử lý xong các sự cố liên quan" and no way forward.
 */
export function CaseClosure({ item, needsExamination, needsRecovery, openTab, reload }: {
  item: MedicalCase; needsExamination: boolean; needsRecovery: boolean; openTab: (tab: 'examination' | 'recovery' | 'treatment') => void; reload: () => void;
}) {
  const { service } = useMedicalRuntime();
  const auth = useAuth(), actor = auth.user, token = authSession.read()?.accessToken;
  const incidents = useMemo(() => token && actor ? createIncidentService(token, actor, auth.handleApiError) : null, [token, actor, auth.handleApiError]);
  const [blockers, setBlockers] = useState<Blockers>(), [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirm, setConfirm] = useState(false);
  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [tasks, linked, restrictionPage] = await Promise.all([
        item.treatmentPlan ? service.listCaseTasks(item.id) : Promise.resolve({ items: [] }),
        incidents ? Promise.all(item.incidentIds.map((id) => incidents.get(id))) : Promise.resolve([]),
        requestApi<{ items: { id: number; level: string; medicalCaseId?: number | null; liftedAt?: string | null }[] }>('/api/medical/restrictions?page=0&size=100', { method: 'GET' }, { token }),
      ]);
      setBlockers({
        pendingTasks: tasks.items.filter((task) => task.status !== 'COMPLETED').length,
        incidents: linked.filter((incident) => incident.status !== 'RESOLVED'),
        restrictions: restrictionPage.items.filter((r) => r.medicalCaseId === item.id && !r.liftedAt),
      });
    } catch (failure) { setLoadError(medicalErrorMessage(failure, 'Không kiểm tra được điều kiện đóng ca.')); }
  }, [item, service, incidents, token]);
  useEffect(() => { void load(); }, [load]);

  async function resolveIncident(incident: Incident) {
    if (!incidents) return;
    setBusy(true); setError('');
    try { await incidents.review(incident.id, 'RESOLVE'); await load(); }
    catch (failure) { setError(medicalErrorMessage(failure, 'Không đóng được sự cố.')); } finally { setBusy(false); }
  }
  async function close() {
    setBusy(true); setError('');
    try { await service.closeCase(item.id); reload(); }
    catch (failure) { setError(medicalErrorMessage(failure, 'Không đóng được ca y tế.')); await load(); } finally { setBusy(false); setConfirm(false); }
  }

  const needsPlanRecovery = item.injuries.length > 0 || !!item.treatmentPlan;
  const rows = [
    { key: 'exam', ok: !needsExamination, label: 'Có ít nhất một lần khám hoặc tái khám', detail: needsExamination ? 'Chưa ghi lần khám nào.' : `${item.examinations.length} lần khám · ${item.reexaminations.length} lần tái khám`,
      action: needsExamination ? <Button size="sm" onClick={() => openTab('examination')}>Ghi lần khám</Button> : null },
    ...(needsPlanRecovery ? [{ key: 'recovery', ok: !needsRecovery, label: 'Tái khám gần nhất ghi Đã hồi phục', detail: needsRecovery ? 'Ca có chấn thương hoặc phác đồ; cần tái khám ghi Đã hồi phục.' : 'Đã hồi phục',
      action: needsRecovery ? <Button size="sm" onClick={() => openTab('recovery')}>Ghi tái khám</Button> : null }] : []),
    ...(item.treatmentPlan ? [{ key: 'tasks', ok: blockers ? blockers.pendingTasks === 0 : undefined, label: 'Groom hoàn thành mọi công việc điều trị',
      detail: !blockers ? 'Đang kiểm tra…' : blockers.pendingTasks ? `Còn ${blockers.pendingTasks} công việc chưa hoàn thành. Groom đánh dấu trong mục Công việc chăm sóc.` : 'Đã hoàn thành',
      action: blockers?.pendingTasks ? <Button size="sm" variant="secondary" onClick={() => openTab('treatment')}>Xem công việc điều trị</Button> : null }] : []),
    { key: 'incidents', ok: blockers ? blockers.incidents.length === 0 : undefined, label: 'Sự cố liên quan đã đóng',
      detail: !blockers ? 'Đang kiểm tra…' : item.incidentIds.length === 0 ? 'Ca không gắn sự cố nào.' : blockers.incidents.length ? `${blockers.incidents.length} sự cố chưa đóng.` : 'Đã đóng hết',
      action: blockers?.incidents.length ? <div className="medical-closure-items">{blockers.incidents.map((incident) => <span key={incident.id}>
        <ButtonLink size="sm" variant="tertiary" to={`/incidents/${incident.id}`}>{viLabel(incident.incidentType)} · {incident.incidentCode}</ButtonLink>
        <Button size="sm" disabled={busy} onClick={() => void resolveIncident(incident)}>Đóng sự cố</Button></span>)}</div> : null },
    { key: 'restrictions', ok: blockers ? blockers.restrictions.length === 0 : undefined, label: 'Hạn chế tập luyện của ca đã gỡ',
      detail: !blockers ? 'Đang kiểm tra…' : blockers.restrictions.length ? `Còn hạn chế ${blockers.restrictions.map((r) => viLabel(r.level)).join(', ')} đang hiệu lực.` : 'Không còn hạn chế của ca',
      action: blockers?.restrictions.length ? <ButtonLink size="sm" to={`/medical/restrictions?horseId=${item.horseId}`}>Gỡ hạn chế</ButtonLink> : null },
  ];
  const ready = rows.every((row) => row.ok === true);
  const remaining = rows.filter((row) => row.ok === false).length;
  return <Card className="medical-close-panel" title="Đóng ca y tế">
    <p className="text-caption">{ready ? 'Ca đã đủ điều kiện đóng.' : remaining ? `Còn ${remaining} điều kiện cần xử lý trước khi đóng ca.` : 'Đang kiểm tra điều kiện đóng ca…'}</p>
    {loadError && <AlertBanner type="warning" title={loadError}><Button size="sm" variant="secondary" onClick={() => void load()}>Kiểm tra lại</Button></AlertBanner>}
    {error && <AlertBanner feedback type="danger" title={error} />}
    <ul className="medical-closure-list" aria-label="Điều kiện đóng ca">{rows.map((row) => <li key={row.key} className={row.ok === false ? 'medical-closure-todo' : row.ok ? 'medical-closure-done' : ''}>
      <Icon name={row.ok ? 'check-circle' : row.ok === false ? 'alert-triangle' : 'clock'} size={20} />
      <div><strong>{row.label}</strong><span>{row.detail}</span></div>
      {row.action && <div className="medical-closure-action">{row.action}</div>}
    </li>)}</ul>
    <div className="medical-actions">{confirm
      ? <><span>Đóng ca {item.id}? Hồ sơ được giữ lại, không xóa.</span><Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>Hủy</Button><Button disabled={busy} onClick={() => void close()}>{busy ? 'Đang đóng…' : 'Xác nhận đóng ca'}</Button></>
      : <Button disabled={!ready || busy} onClick={() => setConfirm(true)}>Đóng ca</Button>}</div>
  </Card>;
}
