import { AlertBanner } from '../../design-system';
import styles from './billing.module.css';

/**
 * The shared popup owns submission and cross-provider locking. This tab explains the sandbox method and configuration;
 * it never declares an invoice paid. Return/IPN/query verification stays on the server.
 */
export function MomoPayTab({ configured }: { configured: boolean }) {
  return <div className={styles.form}>
    <AlertBanner type="info" title="MoMo — thẻ ATM thử nghiệm">
      Bạn sẽ được chuyển sang cổng MoMo test để nhập thẻ ATM thử nghiệm. Không dùng thẻ thật hoặc chuyển tiền thật.
    </AlertBanner>
    <p className={styles.hint}>Hóa đơn chỉ được ghi nhận đã thanh toán sau khi máy chủ xác minh kết quả với MoMo. Đóng popup không hủy giao dịch đang chờ trên cổng thanh toán.</p>
    {!configured && <AlertBanner type="warning" title="MoMo test chưa được cấu hình trên máy chủ." />}
  </div>;
}
