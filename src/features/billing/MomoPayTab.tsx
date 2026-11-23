import styles from './billing.module.css';

/**
 * Instructions under the club's QR code in the MoMo tab. Like VietQR: the owner scans the code with the MoMo app
 * ("Quét mọi QR"), pays from the MoMo wallet, then presses Thanh toán; the server records it as declared by the owner.
 * The MoMo ATM sandbox gateway stays available as a secondary footer action.
 */
export function MomoPayTab({ gatewayConfigured }: { gatewayConfigured: boolean }) {
  return <>
    <p className={styles.hint}>Mở app MoMo, chọn &quot;Quét mọi QR&quot;, quét mã để chuyển đúng số tiền và nội dung từ ví MoMo, rồi bấm Thanh toán.</p>
    {gatewayConfigured && <p className={styles.hint}>Hoặc bấm &quot;Cổng MoMo (thẻ ATM)&quot; để thanh toán qua cổng MoMo thử nghiệm; khi đó hóa đơn chỉ được ghi nhận sau khi MoMo xác nhận.</p>}
  </>;
}
