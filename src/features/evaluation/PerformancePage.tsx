import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AlertBanner, Button, EmptyState, ErrorState, Icon, LoadingState, SelectField } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { ApiError } from '../../shared/auth/authApi';
import type { RoleCode } from '../../shared/auth/roles';
import { evaluationApi, type EvaluationApi } from './api';
import { PerformanceHistory } from './PerformanceHistory';
import { loadPerformanceHorses, type PerformanceHorse, type PerformanceHorseLoader } from './performanceHorses';
import './evaluation.css';

const READ_ROLES: RoleCode[] = ['TRAINER', 'HEAD_TRAINER', 'CLUB_MANAGER', 'VETERINARIAN'];

/** Standalone entry reuses the published CORE-033 history and canonical client; no evaluation code is replaced. */
export function PerformancePage({ api = evaluationApi, loadHorses = loadPerformanceHorses }: { api?: EvaluationApi; loadHorses?: PerformanceHorseLoader }) {
  const { user } = useAuth();
  if (!user) return null;
  const role = READ_ROLES.find((candidate) => user.roles.includes(candidate));
  if (!role) return <AlertBanner type="danger" title="Không có quyền truy cập">Vai trò của bạn không được xem lịch sử thành tích của ngựa.</AlertBanner>;
  return <AppShell designSystem="v2" user={{ fullName: user.fullName, role }} breadcrumb={[{ label: 'Huấn luyện' }, { label: 'Lịch sử thành tích' }]}>
    <PerformanceWorkspace key={user.id} api={api} loadHorses={loadHorses} assignedToMe={user.roles.includes('TRAINER')} />
  </AppShell>;
}

function PerformanceWorkspace({ api, loadHorses, assignedToMe }: { api: EvaluationApi; loadHorses: PerformanceHorseLoader; assignedToMe: boolean }) {
  const { handleApiError } = useAuth();
  const [search, setSearch] = useSearchParams();
  const [state, setState] = useState<{ horses?: PerformanceHorse[]; error?: unknown }>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    loadHorses(assignedToMe, controller.signal).then((horses) => { if (active) setState({ horses }); })
      .catch((error: unknown) => { if (active && !handleApiError(error)) setState({ error }); });
    return () => { active = false; controller.abort(); };
  }, [assignedToMe, loadHorses, attempt, handleApiError]);
  const requested = search.get('horseId');
  const selected = requested === null ? state.horses?.[0] : state.horses?.find((horse) => /^[1-9]\d*$/.test(requested) && horse.id === Number(requested));
  const retry = () => { setState({}); setAttempt((value) => value + 1); };
  return <div className="evaluation-stack">
    <div className="evaluation-actions"><div><h1 className="text-h1"><Icon name="trending-up" size={24} /> Lịch sử thành tích</h1><p className="text-body">Dữ liệu theo buổi tập của các ngựa trong chương trình bạn được phép xem.</p></div></div>
    {state.error ? state.error instanceof ApiError && state.error.status === 403
      ? <AlertBanner type="danger" title="Không có quyền truy cập">Các chương trình này nằm ngoài phạm vi được phép của bạn. Phiên đăng nhập vẫn còn hiệu lực.</AlertBanner>
      : <ErrorState title="Không mở được trang thành tích" description={state.error instanceof Error ? state.error.message : 'Không tải được danh sách chương trình.'} onRetry={retry} />
      : !state.horses ? <LoadingState label="Đang tải danh sách ngựa được phép xem…" /> : state.horses.length === 0
        ? <EmptyState title="Không có ngựa nào" description="Tài khoản của bạn chưa có chương trình nào." />
        : <><div className="evaluation-horse-select"><SelectField label="Ngựa" value={String(selected?.id ?? '')} placeholder="Chọn ngựa" options={state.horses.map((horse) => ({ value: String(horse.id), label: `${horse.name} · ${horse.horseCode}` }))} onChange={(event) => setSearch({ horseId: event.target.value })} /></div>
          {selected ? <PerformanceHistory key={selected.id} horseId={selected.id} api={api} onError={handleApiError} />
            : <><EmptyState title="Không có ngựa này" description="Hãy chọn một ngựa trong danh sách của bạn." /><Button variant="secondary" onClick={() => setSearch({})}>Chọn ngựa đầu tiên</Button></>}
        </>}
  </div>;
}
