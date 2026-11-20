import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AlertBanner, Button, Card, EmptyState, ErrorState, LoadingState, MetricCard, Modal, TextAreaField, TextField } from '../../design-system';
import { AppShell } from '../../layout/AppShell';
import { useAuth } from '../../shared/auth/AuthProvider';
import { authSession } from '../../shared/auth/authSession';
import type { RoleCode } from '../../shared/auth/roles';
import { useSupportingLoad } from '../training/assigned/supportingHooks';
import { createStableMapApi, toGridBox, type MapBox, type MapYard, type StableMap, type StableMapApi } from './stableMapApi';
import { GridLegend, StableYardGrid } from './StableYardGrid';
import styles from './stableMap.module.css';

const READERS: RoleCode[] = ['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM', 'WORK_RIDER'];
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Không thực hiện được thao tác. Hãy thử lại.';

/**
 * DEC-016 "Sơ đồ chuồng": every yard as its real grid with the horse in each box. Capacity = sum of the yard grids.
 * Club Manager adds a yard (bounded rows x columns) and puts a free box under maintenance or reopens it.
 */
export function StableMapPage() {
  const auth = useAuth();
  const token = authSession.read()?.accessToken;
  const role = auth.user?.roles.find((value) => READERS.includes(value));
  const api = useMemo(() => token ? createStableMapApi(token, auth.handleApiError) : null, [token, auth.handleApiError]);
  if (!role || !auth.user || !api) return <AlertBanner type="danger" title="Đăng nhập bằng vai trò nhân sự để xem sơ đồ chuồng." />;
  return <AppShell designSystem="v2" user={{ fullName: auth.user.fullName, role }} breadcrumb={[{ label: 'Chuồng trại' }, { label: 'Sơ đồ chuồng' }]}>
    <MapContent api={api} manager={role === 'CLUB_MANAGER'} />
  </AppShell>;
}

function MapContent({ api, manager }: { api: StableMapApi; manager: boolean }) {
  const load = useSupportingLoad(() => api.map(), [api]);
  const [map, setMap] = useState<StableMap>();
  const current = map ?? load.data;
  const [boxAction, setBoxAction] = useState<{ yard: MapYard; box: MapBox }>();
  const [addYard, setAddYard] = useState(false);
  const [notice, setNotice] = useState('');

  if (load.error && !current) return <ErrorState title="Không tải được sơ đồ chuồng" description={message(load.error)} onRetry={load.retry} />;
  if (!current) return <LoadingState label="Đang tải sơ đồ chuồng…" />;
  const used = current.yards.length;

  return <section className={styles.stack}>
    <header data-page-banner className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Chuồng trại</p>
        <h1>Sơ đồ chuồng</h1>
        <p>Mỗi khu chuồng là một lưới hàng × cột cố định; mỗi ô chứa tối đa một con ngựa. Sức chứa của trang trại bằng tổng số ô của các khu.</p>
      </div>
      {manager && <Button onClick={() => setAddYard(true)} disabled={used >= current.limits.maxYards}>Thêm khu chuồng</Button>}
    </header>
    {notice && <AlertBanner feedback type="success" title={notice} />}
    <div className={styles.summary}>
      <MetricCard label="Sức chứa" value={`${current.totalCapacity} ô`} caption={`${used}/${current.limits.maxYards} khu chuồng`} />
      <MetricCard label="Đang có ngựa" value={String(current.occupied)} caption={current.totalCapacity ? `${Math.round(current.occupied * 100 / current.totalCapacity)}% sức chứa` : undefined} />
      <MetricCard label="Còn trống" value={String(current.free)} caption={current.free === 0 ? 'Chuồng đã đầy — không nhận thêm ngựa' : 'Có thể xếp ngựa mới'} />
      <MetricCard label="Đang bảo trì" value={String(current.maintenance)} caption="Không xếp ngựa vào ô bảo trì" />
    </div>
    <GridLegend />
    {current.outsideLayout.length > 0 && <AlertBanner type="warning" title="Có ngựa đang ở ô ngoài sơ đồ">
      <p>Các ô này thuộc dữ liệu cũ, không nằm trong khu chuồng nào. Hãy chuyển ngựa sang một ô trống trong sơ đồ; ô cũ sẽ tự ngừng sử dụng.</p>
      <ul className={styles.outside}>{current.outsideLayout.map((box) => <li key={box.id}>
        {box.boxCode}: <Link className={styles.mapLink} to={`/horses/${box.horse.id}`}>{box.horse.name} ({box.horse.horseCode})</Link>
      </li>)}</ul>
    </AlertBanner>}
    {current.yards.length === 0 && <EmptyState title="Chưa có khu chuồng" description={manager ? 'Thêm khu chuồng đầu tiên để tạo các ô.' : 'Club Manager chưa cấu hình khu chuồng.'} />}
    {current.yards.map((yard) => <Card key={yard.id} className={styles.yardCard}>
      <div className={styles.yardHead}>
        <h2>{yard.name}</h2>
        <span>{`${yard.rowCount} hàng × ${yard.columnCount} cột = ${yard.rowCount * yard.columnCount} ô · ${yard.occupied} có ngựa · ${yard.free} trống · ${yard.maintenance} bảo trì`}</span>
      </div>
      <div className={styles.scroll}>
        <StableYardGrid name={yard.name} rowCount={yard.rowCount} columnCount={yard.columnCount} boxes={yard.boxes.map(toGridBox)}
          onSelect={(cell) => {
            const box = yard.boxes.find((item) => item.id === cell.id);
            if (box) setBoxAction({ yard, box });
          }}
          selectable={(cell) => cell.state === 'occupied' || manager} />
      </div>
    </Card>)}
    {boxAction && <BoxModal api={api} manager={manager} yard={boxAction.yard} box={boxAction.box} onClose={() => setBoxAction(undefined)}
      onSaved={(next, text) => { setMap(next); setBoxAction(undefined); setNotice(text); }} />}
    {addYard && <AddYardModal api={api} map={current} onClose={() => setAddYard(false)}
      onSaved={(next, code) => { setMap(next); setAddYard(false); setNotice(`Đã thêm khu chuồng ${code}.`); }} />}
  </section>;
}

function BoxModal({ api, manager, yard, box, onClose, onSaved }: {
  api: StableMapApi; manager: boolean; yard: MapYard; box: MapBox; onClose: () => void; onSaved: (map: StableMap, notice: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const position = `hàng ${String.fromCharCode(64 + box.rowNo)}, cột ${box.columnNo}`;
  const maintenance = box.boxStatus === 'MAINTENANCE';
  const save = async () => {
    if (lock.current) return;
    if (!maintenance && !reason.trim()) { setError('Nhập lý do bảo trì.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const next = await api.setBoxStatus(box.id, maintenance ? 'ACTIVE' : 'MAINTENANCE', reason.trim());
      onSaved(next, maintenance ? `Đã mở lại ô ${box.boxCode}.` : `Ô ${box.boxCode} đang bảo trì.`);
    } catch (cause) { setError(message(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  const canChange = manager && !box.horse;
  return <Modal open title={`Ô ${box.boxCode} · ${yard.name}`} onClose={busy ? () => undefined : onClose}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Đóng</Button>
      {canChange && <Button variant={maintenance ? 'primary' : 'danger'} onClick={save} disabled={busy}>{maintenance ? 'Mở lại ô' : 'Chuyển sang bảo trì'}</Button>}
    </>}>
    <div className={styles.form}>
      <p className={styles.hint}>{`Vị trí: ${position}.`}</p>
      {box.horse
        ? <p>Đang có ngựa <Link className={styles.mapLink} to={`/horses/${box.horse.id}`}>{box.horse.name} ({box.horse.horseCode})</Link>. {manager ? 'Muốn bảo trì ô này, hãy chuyển ngựa sang ô khác trước.' : ''}</p>
        : <p>{maintenance ? 'Ô đang bảo trì nên không thể xếp ngựa.' : 'Ô đang trống, có thể xếp ngựa.'}</p>}
      {canChange && !maintenance && <TextAreaField label="Lý do bảo trì" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />}
      {error && <AlertBanner feedback type="danger" title="Không lưu được">{error}</AlertBanner>}
    </div>
  </Modal>;
}

function AddYardModal({ api, map, onClose, onSaved }: { api: StableMapApi; map: StableMap; onClose: () => void; onSaved: (map: StableMap, code: string) => void }) {
  const used = new Set(map.yards.map((yard) => yard.yardCode));
  const nextCode = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((code) => !used.has(code)) ?? '';
  const [code, setCode] = useState(nextCode);
  const [name, setName] = useState(nextCode ? `Khu chuồng ${nextCode}` : '');
  const [rows, setRows] = useState('2');
  const [columns, setColumns] = useState('10');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const { maxRows, maxColumns } = map.limits;
  const rowCount = Number(rows); const columnCount = Number(columns);
  const invalid = !/^[A-Za-z]$/.test(code) ? 'Mã khu là một chữ cái A–Z.'
    : used.has(code.toUpperCase()) ? `Khu ${code.toUpperCase()} đã tồn tại.`
      : !name.trim() ? 'Nhập tên khu chuồng.'
        : !Number.isInteger(rowCount) || rowCount < 1 || rowCount > maxRows ? `Số hàng từ 1 đến ${maxRows}.`
          : !Number.isInteger(columnCount) || columnCount < 1 || columnCount > maxColumns ? `Số cột từ 1 đến ${maxColumns}.` : '';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (invalid) { setError(invalid); return; }
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { onSaved(await api.createYard({ yardCode: code.toUpperCase(), name: name.trim(), rowCount, columnCount }), code.toUpperCase()); }
    catch (cause) { setError(message(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal open title="Thêm khu chuồng" onClose={busy ? () => undefined : onClose}
    footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Hủy</Button><Button type="submit" form="add-yard" disabled={busy}>Tạo khu chuồng</Button></>}>
    <form id="add-yard" className={styles.form} onSubmit={submit} noValidate>
      <p className={styles.hint}>{`Giới hạn: tối đa ${map.limits.maxYards} khu, mỗi khu ${maxRows} hàng × ${maxColumns} cột. Các ô được tạo đủ theo lưới, mã ô dạng ${(code || 'A').toUpperCase()}-01.`}</p>
      <div className={styles.formRow}>
        <TextField label="Mã khu (A–Z)" value={code} maxLength={1} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        <TextField label="Tên khu chuồng" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className={styles.formRow}>
        <TextField label={`Số hàng (1–${maxRows})`} type="number" min={1} max={maxRows} value={rows} onChange={(event) => setRows(event.target.value)} />
        <TextField label={`Số cột (1–${maxColumns})`} type="number" min={1} max={maxColumns} value={columns} onChange={(event) => setColumns(event.target.value)} />
      </div>
      {!invalid && <p className={styles.hint}>{`Khu mới có ${rowCount * columnCount} ô. Sức chứa sau khi thêm: ${map.totalCapacity + rowCount * columnCount} ô.`}</p>}
      {error && <AlertBanner feedback type="danger" title="Chưa tạo được khu chuồng">{error}</AlertBanner>}
    </form>
  </Modal>;
}
