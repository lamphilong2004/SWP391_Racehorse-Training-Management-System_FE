import { ButtonLink, Card } from '../../design-system';

/** A receipt appears only after the caller receives a successful incident response. */
export function IncidentReportReceipt({ incidentId, incidentCode, status = 'REPORTED', sessionInterrupted = false }: {
  incidentId: number;
  incidentCode: string;
  status?: 'REPORTED' | 'UNDER_REVIEW' | 'RESOLVED';
  sessionInterrupted?: boolean;
}) {
  const title = status === 'RESOLVED' ? 'Thú y đã xử lý sự cố' : status === 'UNDER_REVIEW' ? 'Thú y đang xử lý báo cáo' : 'Đã gửi báo cáo · Chờ thú y tiếp nhận';
  return <Card title={title}>
    <p>Báo cáo {incidentCode} đã được ghi nhận. Bạn có thể theo dõi tiến trình xử lý tại đây.</p>
    {sessionInterrupted && <p>Buổi tập đã được ghi nhận là Bị gián đoạn. Trainer sẽ xem kết quả buổi tập. Veterinarian xử lý vấn đề sức khỏe.</p>}
    <p>Veterinarian quyết định việc khám, điều trị và hạn chế tập luyện. Kết quả kiểm tra và trạng thái buổi tập được theo dõi riêng với trạng thái sự cố.</p>
    <ButtonLink variant="primary" to={`/incidents/${incidentId}`}>Theo dõi báo cáo</ButtonLink>
  </Card>;
}
