import { useRef, useState, type FormEvent } from 'react';
import { AlertBanner, Button, Modal, SelectField, TextAreaField, TextField } from '../../design-system';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import type { RiderApi } from './api';
import { errorMessage } from './data';
import { metricInput, type IssueInput, type RiderSession } from './types';
import styles from './rider.module.css';

export function IssueDialog({ session, api, onClose, onSaved }: { session: RiderSession; api: RiderApi; onClose: () => void; onSaved: (code: string) => void }) {
  const { handleApiError } = useAuth();
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current || conflict) return;
    if (session.status !== 'IN_PROGRESS' && session.status !== 'PAUSED') { setError('This ride is not in progress. Ask the assigned Groom or Trainer to review readiness.'); return; }
    if (!type || !severity || !description.trim() || description.trim().length > 1000) { setError('Select the type and observed severity, and describe what you see (1–1000 characters).'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await api.issue(session.id, { incidentType: type as IssueInput['incidentType'], observedSeverity: severity as IssueInput['observedSeverity'], description: description.trim(), observedAt: new Date().toISOString() });
      if (!Number.isSafeInteger(response.incidentId) || response.incidentId < 1 || !response.incidentCode) throw new ApiError(201, 'INVALID_RESPONSE', 'The issue response could not be confirmed. Reload the ride before retrying.');
      onSaved(response.incidentCode);
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflict(true);
        setError(errorMessage(cause));
      }
    } finally { pending.current = false; setBusy(false); }
  }
  const dirty = Boolean(type || severity || description.trim());
  // Typed issue details are never dismissed by Escape/backdrop; Cancel is the explicit discard.
  return <Modal open dismissible={!busy && !dirty} onClose={busy ? () => undefined : onClose} title="Report an issue" footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>{conflict ? 'Close and reload ride' : 'Cancel'}</Button><Button type="submit" form="rider-issue-form" disabled={busy || conflict}>{busy ? 'Submitting…' : 'Submit Issue'}</Button></>}><form id="rider-issue-form" onSubmit={submit} className={styles.smallStack}><p>{session.horse.name} · {session.sessionCode}</p><SelectField label="What did you notice?" value={type} onChange={(event) => setType(event.target.value)} disabled={busy || conflict} options={[{ value: '', label: 'Select observed issue' }, { value: 'OFF_FEED', label: 'Off feed' }, { value: 'COLIC_SIGNS', label: 'Colic signs' }, { value: 'FEVER', label: 'Fever' }, { value: 'HOOF_OR_LEG_PROBLEM', label: 'Hoof or leg problem' }, { value: 'OTHER', label: 'Other' }]} /><SelectField label="Observed severity" value={severity} disabled={busy || conflict} onChange={(event) => setSeverity(event.target.value)} options={[{ value: '', label: 'Select severity' }, ...['LOW', 'MEDIUM', 'HIGH'].map((value) => ({ value, label: value }))]} /><TextAreaField label="Describe what you see" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} disabled={busy || conflict} /><AlertBanner type="warning" title="Stop riding safely">An active or paused session becomes INTERRUPTED when the server accepts this issue. The report is available for Trainer and Veterinarian review. Describe observations, not a diagnosis.</AlertBanner>{error && <AlertBanner type="danger" title="Issue could not be confirmed">{error}</AlertBanner>}</form></Modal>;
}

export function MetricDialog({ session, api, onClose, onSaved }: { session: RiderSession; api: RiderApi; onClose: () => void; onSaved: () => void }) {
  const { handleApiError } = useAuth();
  const [fields, setFields] = useState({ heartRate: '', speedKmh: '', distanceM: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending.current || conflict) return;
    let body;
    try { body = metricInput(fields); } catch (cause) { setError(errorMessage(cause)); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await api.metric(session.id, body);
      if (!Number.isSafeInteger(response.sampleId) || response.sampleId < 1) throw new ApiError(201, 'INVALID_RESPONSE', 'Sample response could not be confirmed. Close and reload the ride before retrying.');
      onSaved();
    } catch (cause) {
      if (!handleApiError(cause)) {
        if (cause instanceof ApiError && (cause.status === 409 || cause.code === 'INVALID_RESPONSE')) setConflict(true);
        setError(errorMessage(cause));
      }
    }
    finally { pending.current = false; setBusy(false); }
  }
  const dirty = Object.values(fields).some((value) => value.trim() !== '');
  return <Modal open dismissible={!busy && !dirty} onClose={busy ? () => undefined : onClose} title="Add manual sample" footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>{conflict ? 'Close and reload ride' : 'Cancel'}</Button><Button type="submit" form="rider-metric-form" disabled={busy || conflict}>{busy ? 'Saving…' : 'Save sample'}</Button></>}><form id="rider-metric-form" onSubmit={submit} className={styles.smallStack}><p>Enter measured values only. Blank fields remain null; zero is a valid measurement.</p>{([{ key: 'heartRate', label: 'Heart rate (bpm)', step: '1' }, { key: 'speedKmh', label: 'Speed (km/h)', step: 'any' }, { key: 'distanceM', label: 'Distance (m)', step: 'any' }] as const).map(({ key, label, step }) => <TextField key={key} label={label} type="number" min={0} step={step} value={fields[key]} disabled={busy || conflict} onChange={(event) => setFields((old) => ({ ...old, [key]: event.target.value }))} />)}{error && <AlertBanner type="danger" title="Sample not saved">{error}</AlertBanner>}</form></Modal>;
}
