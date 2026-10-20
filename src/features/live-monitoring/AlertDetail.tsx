import { AlertBanner, Button, KeyValue, Modal, StatusBadge } from '../../design-system';
import { dateTime, metric, type UserRef } from '../evaluation/models';
import styles from '../main-flows/flow.module.css';

/** WARNING events are transient and have no persisted alert ID. REST alerts are CRITICAL only. */
export interface MonitoringAlertView {
  id?: number | null; sessionId: number; severity: 'WARNING' | 'CRITICAL'; metric?: string;
  metricValue?: number | null; thresholdApplied?: number | null; raisedAt?: string | null;
  acknowledgedAt?: string | null; acknowledgedBy?: UserRef | null; actionTaken?: string | null;
  escalatedToVetAt?: string | null; simulated?: boolean;
}
export function AlertDetail({ alert, horse, canAcknowledge, busy, error, onClose, onAcknowledge }: {
  alert?: MonitoringAlertView; horse?: string; canAcknowledge: boolean; busy: boolean; error?: string;
  onClose: () => void; onAcknowledge: (id: number) => void;
}) {
  return <Modal open={!!alert} onClose={onClose} title="Alert Detail" footer={<>
    <Button variant="secondary" onClick={onClose}>Close alert</Button>
    {alert?.severity === 'CRITICAL' && alert.id && !alert.acknowledgedAt && canAcknowledge && <Button disabled={busy} onClick={() => onAcknowledge(alert.id!)}>Acknowledge alert</Button>}
  </>}>
    {alert && <div className={styles.stack}>
      <StatusBadge family="realtime" status={alert.severity} />
      {alert.simulated && <AlertBanner type="simulated" title="SIMULATED DEMO DATA">This alert was marked simulated by the server.</AlertBanner>}
      {error && <AlertBanner type="danger" title="Action not confirmed">{error}</AlertBanner>}
      <div className={styles.fields}>
        <KeyValue label="Horse" value={horse ?? 'Not provided'} /><KeyValue label="Session" value={String(alert.sessionId)} />
        <KeyValue label="Alert ID" value={alert.id ?? 'Unavailable · transient WARNING event'} /><KeyValue label="Metric" value={alert.metric ?? 'Not provided'} />
        <KeyValue label="Metric value" value={metric(alert.metricValue, 'bpm')} /><KeyValue label="Applied threshold" value={metric(alert.thresholdApplied, 'bpm')} />
        <KeyValue label="Raised at" value={dateTime(alert.raisedAt)} /><KeyValue label="Acknowledged at" value={dateTime(alert.acknowledgedAt)} />
        <KeyValue label="Acknowledged by" value={alert.acknowledgedBy?.fullName ?? 'Not provided'} /><KeyValue label="Action taken" value={alert.actionTaken ?? 'Not provided'} />
        <KeyValue label="Escalated to Veterinarian" value={dateTime(alert.escalatedToVetAt)} /><KeyValue label="Current exercise / repetition" value="Not provided" />
      </div>
      <p>The server supplies severity and the applied threshold. No clinical classification or threshold is calculated here.</p>
      {alert.severity === 'WARNING' && <p>WARNING is transient and cannot be acknowledged through the persisted critical-alert API.</p>}
      {!canAcknowledge && <p>Read-only. Only the assigned Trainer or Veterinarian may acknowledge a critical alert.</p>}
    </div>}
  </Modal>;
}
