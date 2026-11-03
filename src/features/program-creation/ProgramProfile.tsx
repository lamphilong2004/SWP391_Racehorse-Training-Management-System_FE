import { useCallback } from 'react';
import { Card, ChartContainer, EmptyState, ErrorState, KeyValue, LoadingState, StatusBadge } from '../../design-system';
import type { HorseDetail } from '../horses/api/types';
import { ageInYears } from '../horses/shared/format';
import { useFlowRequest } from '../main-flows/api';
import { useResource } from '../main-flows/useResource';
import type { HorseSelection } from './programTypes';
import styles from './ProgramCreationPage.module.css';

/** SCR-TRAIN-003 S2: unsupported analytics stay explicitly unavailable rather than becoming fixture charts. */
export function ProgramProfile({ horse }: { horse: HorseSelection }) {
  const request = useFlowRequest();
  const load = useCallback((signal: AbortSignal) => request<HorseDetail>(`/api/horses/${horse.id}`, { signal }), [request, horse.id]);
  const resource = useResource(load), profile = resource.data;
  return <div className={styles.columns}><div className={styles.stack}><Card title="Hồ sơ huấn luyện" action={<span className="text-caption">Chỉ xem</span>}>
    {resource.pending && <LoadingState label="Đang tải hồ sơ ngựa…" />}{resource.error && <ErrorState title="Không tải được hồ sơ" description={resource.error} onRetry={resource.reload} />}
    <div className={styles.profileFacts}><KeyValue label="Giống ngựa" value={profile?.breed ?? horse.breed ?? 'Chưa cung cấp'} /><KeyValue label="Tuổi" value={ageInYears(profile?.foaledDate ?? horse.foaledDate) == null ? 'Chưa cung cấp' : `${ageInYears(profile?.foaledDate ?? horse.foaledDate)} tuổi`} /><KeyValue label="Giới tính" value={profile?.sex ?? horse.sex ?? 'Chưa cung cấp'} /><KeyValue label="Cân nặng" value={profile?.latestWeight ? `${profile.latestWeight.weightKg} kg` : 'Chưa cung cấp'} /><KeyValue label="Khả năng tập luyện" value={<StatusBadge family="availability" status={profile?.trainingAvailability ?? horse.trainingAvailability} />} /></div>
  </Card><Card title="Tóm tắt thể lực"><EmptyState title="Chưa có đánh giá thể lực" description="Hệ thống chưa cung cấp đánh giá thể lực. Không tự suy ra đánh giá từ số liệu đã ghi." /></Card><div className={styles.fields}>
    <ChartContainer title="Khối lượng tập gần đây" seriesLabel="Khối lượng đã ghi" values={[]} yTicks={[1, 0]} xLabels={[]} emptyTitle="Chưa có khối lượng theo tuần" emptyDescription="Hệ thống chưa cung cấp chuỗi khối lượng theo tuần." />
    <ChartContainer title="Xu hướng thành tích gần đây" seriesLabel="Tốc độ tối đa" values={[]} yTicks={[1, 0]} xLabels={[]} emptyTitle="Chưa có xu hướng tốc độ tối đa" emptyDescription="Hệ thống chưa cung cấp chuỗi tốc độ tối đa." />
  </div></div><div className={styles.stack}><Card title="Tóm tắt hạn chế y tế"><StatusBadge family="availability" status={horse.trainingAvailability} /><p className="text-caption">Khả năng tập luyện chỉ xem ở đây. Chi tiết y tế do đội thú y quản lý.</p></Card><Card title="Buổi tập gần nhất"><EmptyState title="Chưa có tóm tắt buổi tập" description="Hồ sơ ngựa chưa kèm tóm tắt buổi tập gần nhất." /></Card><Card title="Điểm mạnh & nhu cầu phát triển"><EmptyState title="Chưa có đánh giá" description="Không tự suy ra đánh giá từ dữ liệu thử hay công thức phía giao diện." /></Card></div></div>;
}
