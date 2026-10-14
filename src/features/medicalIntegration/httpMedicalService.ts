import { api } from '../../shared/api/http';
import type { CaseView, Incident, MedicalCase, MedicalService, TaskView } from '../medical/models';

/**
 * DEMO INTEGRATION: real HTTP implementation of the CORE-036 MedicalService interface against the BE demo branch
 * (CORE-026 incidents, CORE-035 medical cases). The CORE-036 pages are reused unchanged.
 * Horse references typed as a code (e.g. "TB-001") are resolved to the numeric id.
 */
const SEVERITY = ['MILD', 'MODERATE', 'SEVERE'];
const sev = (v?: string) => (v && SEVERITY.includes(v.trim().toUpperCase()) ? v.trim().toUpperCase() : null);

interface BeCase {
  id: number; horseId: number; status: string; reason?: string; incidentIds?: number[];
  examinations?: { id: number; symptoms: string; diagnosis?: string; severity?: string }[];
  injuries?: { id: number; bodyRegion: string; severity: string; recoveryStatus: CaseView['injuries'][number]['recoveryStatus']; position3d?: string }[];
  treatmentPlan?: { id: number; treatmentMedicationInstructions: string; restInstructions?: string; careInstructions?: string; reexaminationDate?: string };
  reexaminations?: { id: number; recoveryStatus: 'NOT_RECOVERED' | 'IMPROVING' | 'RECOVERED'; findings: string }[];
}

async function resolveHorse(ref: string): Promise<number> {
  const trimmed = ref.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const page = await api<{ items: { id: number; horseCode: string; name: string }[] }>(`/api/horses?size=100&q=${encodeURIComponent(trimmed)}`);
  const hit = page.items.find((h) => h.horseCode.toLowerCase() === trimmed.toLowerCase() || h.name.toLowerCase() === trimmed.toLowerCase());
  if (!hit) throw new Error(`Horse "${trimmed}" not found. Use the horse code, e.g. TB-001.`);
  return hit.id;
}

function toView(c: BeCase): CaseView {
  return {
    id: String(c.id), horseId: String(c.horseId), status: c.status, reason: c.reason,
    incidentId: c.incidentIds?.length ? String(c.incidentIds[0]) : undefined,
    examinations: (c.examinations ?? []).map((e) => ({ id: String(e.id), caseId: String(c.id), symptoms: e.symptoms, diagnosis: e.diagnosis, severity: e.severity })),
    injuries: (c.injuries ?? []).map((i) => {
      let position3d: { x: number; y: number; z: number } | undefined;
      try { position3d = i.position3d ? JSON.parse(i.position3d) : undefined; } catch { position3d = undefined; }
      return { id: String(i.id), caseId: String(c.id), bodyRegion: i.bodyRegion, severity: i.severity, recoveryStatus: i.recoveryStatus, position3d };
    }),
    treatment: c.treatmentPlan ? {
      id: String(c.treatmentPlan.id), caseId: String(c.id), restInstructions: c.treatmentPlan.restInstructions,
      medications: [{ name: c.treatmentPlan.treatmentMedicationInstructions }], reexaminationDate: c.treatmentPlan.reexaminationDate,
    } : undefined,
    reexaminations: (c.reexaminations ?? []).map((r) => ({ id: String(r.id), caseId: String(c.id), recoveryStatus: r.recoveryStatus, findings: r.findings })),
  };
}

export function createHttpMedicalService(): MedicalService {
  return {
    mode: 'http',
    async listCases(): Promise<MedicalCase[]> {
      const page = await api<{ items: BeCase[] }>('/api/medical/cases?size=100');
      return page.items.map((c) => ({ id: String(c.id), horseId: String(c.horseId), status: c.status, reason: c.reason,
        incidentId: c.incidentIds?.length ? String(c.incidentIds[0]) : undefined }));
    },
    async getCase(id) {
      return toView(await api<BeCase>(`/api/medical/cases/${id}`));
    },
    async createCase(input) {
      const horseId = await resolveHorse(input.horseId);
      const created = await api<BeCase>('/api/medical/cases', {
        body: { horseId, reason: input.reason, ...(input.incidentId ? { incidentId: Number(input.incidentId.replace(/\D/g, '')) } : {}) },
      });
      return { id: String(created.id), horseId: String(created.horseId), status: created.status, reason: created.reason };
    },
    async addExamination(id, input) {
      await api(`/api/medical/cases/${id}/examinations`, {
        body: { symptoms: input.symptoms, diagnosis: input.diagnosis || null, severity: sev(input.severity), examinedAt: input.examinedAt || new Date().toISOString() },
      });
    },
    async addInjury(id, input) {
      const severity = sev(input.severity);
      if (!severity) throw new Error('Injury severity must be Mild, Moderate or Severe.');
      await api(`/api/medical/cases/${id}/injuries`, {
        body: { bodyRegion: input.bodyRegion, severity, recoveryStatus: input.recoveryStatus ?? 'NOT_RECOVERED',
          position3d: input.position3d ? JSON.stringify(input.position3d) : null },
      });
    },
    async saveTreatment(id, input) {
      const meds = (input.medications ?? []).map((m) => (m.instructions ? `${m.name}: ${m.instructions}` : m.name)).join('; ');
      await api(`/api/medical/cases/${id}/treatment-plan`, {
        method: 'PUT',
        body: {
          treatmentMedicationInstructions: meds || input.restInstructions || 'See care instructions',
          restInstructions: input.restInstructions?.slice(0, 100) || null,
          groomTasks: (input.groomTasks ?? []).map((t) => ({ instruction: t.instruction, taskDate: (t.dueAt ?? new Date().toISOString()).slice(0, 10) })),
          reexaminationDate: input.reexaminationDate || null,
        },
      });
    },
    async addReexamination(id, input) {
      await api(`/api/medical/cases/${id}/re-examinations`, {
        body: { recoveryStatus: input.recoveryStatus, findings: input.findings, examinedAt: input.examinedAt || new Date().toISOString() },
      });
    },
    async closeCase(id) {
      await api(`/api/medical/cases/${id}/close`, { method: 'POST' });
    },
    async listIncidents(): Promise<Incident[]> {
      const page = await api<{ items: { id: number; incidentCode: string; horseId: number; description?: string; status: string }[] }>('/api/incidents?size=100');
      return page.items.map((i) => ({ id: String(i.id), horseId: String(i.horseId), description: `${i.incidentCode} — ${i.description ?? ''}`, status: i.status }));
    },
    async listTasks(): Promise<TaskView[]> {
      const page = await api<{ items: { id: number; horseId: number; instruction: string; status: string }[] }>('/api/groom/treatment-tasks?size=100');
      return page.items.map((t) => ({ id: String(t.id), horseId: String(t.horseId), instruction: t.instruction, status: t.status }));
    },
    async completeTask(id) {
      await api(`/api/groom/treatment-tasks/${id}/complete`, { body: {} });
    },
  };
}
