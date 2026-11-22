import { AlertBanner } from '../../design-system';
import styles from './billing.module.css';

/**
 * MoMo tab of the pay popup. Placeholder until the MoMo ATM sandbox (issue #63, PR FE #71) completes a real test
 * payment: that PR replaces this component with the MoMo checkout and fills `footer` with its pay action.
 */
export function MomoPayTab() {
  return <div className={styles.form}>
    <AlertBanner type="info" title="MoMo đang được tích hợp">
      Thanh toán qua MoMo (môi trường thử nghiệm) sẽ dùng được khi tích hợp hoàn tất. Hiện bạn có thể thanh toán bằng VNPay hoặc mã VietQR.
    </AlertBanner>
  </div>;
}
