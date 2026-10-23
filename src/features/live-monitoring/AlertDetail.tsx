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
  return <Modal open={!!alert} onClose={onClose} title="Chi tiết cảnh báo" footer={<>
    <Button variant="secondary" onClick={onClose}>Đóng cảnh báo</Button>
    {alert?.severity === 'CRITICAL' && alert.id && !alert.acknowledgedAt && canAcknowledge && <Button disabled={busy} onClick={() => onAcknowledge(alert.id!)}>Xác nhận cảnh báo</Button>}
  </>}>
    {alert && <div className={styles.stack}>
      <StatusBadge family="realtime" status={alert.severity} />
      {alert.simulated && <AlertBanner type="simulated" title="DỮ LIỆU MÔ PHỎNG">Máy chủ đánh dấu cảnh báo này là dữ liệu mô phỏng.</AlertBanner>}
      {error && <AlertBanner type="danger" title="Chưa xác nhận thao tác">{error}</AlertBanner>}
      <div className={styles.fields}>
        <KeyValue label="Ngựa" value={horse ?? 'Chưa cung cấp'} /><KeyValue label="Buổi tập" value={String(alert.sessionId)} />
        <KeyValue label="Mã cảnh báo" value={alert.id ?? 'Không có · cảnh báo tạm thời'} /><KeyValue label="Chỉ số" value={alert.metric ?? 'Chưa cung cấp'} />
        <KeyValue label="Giá trị đo" value={metric(alert.metricValue, 'bpm')} /><KeyValue label="Ngưỡng áp dụng" value={metric(alert.thresholdApplied, 'bpm')} />
        <KeyValue label="Phát lúc" value={dateTime(alert.raisedAt)} /><KeyValue label="Xác nhận lúc" value={dateTime(alert.acknowledgedAt)} />
        <KeyValue label="Người xác nhận" value={alert.acknowledgedBy?.fullName ?? 'Chưa cung cấp'} /><KeyValue label="Biện pháp đã thực hiện" value={alert.actionTaken ?? 'Chưa cung cấp'} />
        <KeyValue label="Đã chuyển Veterinarian" value={dateTime(alert.escalatedToVetAt)} /><KeyValue label="Bài tập / lượt hiện tại" value="Chưa cung cấp" />
      </div>
      <p>Máy chủ cung cấp mức độ và ngưỡng áp dụng. Ở đây không tự phân loại y tế hay tính ngưỡng.</p>
      {alert.severity === 'WARNING' && <p>Cảnh báo thường chỉ là tạm thời và không xác nhận được như cảnh báo nghiêm trọng.</p>}
      {!canAcknowledge && <p>Chỉ xem. Chỉ Trainer được phân công hoặc Veterinarian mới được xác nhận cảnh báo nghiêm trọng.</p>}
    </div>}
  </Modal>;
}
