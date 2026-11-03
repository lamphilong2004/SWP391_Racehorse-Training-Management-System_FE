import { boxLabel, yardLabel } from '../../../shared/stableBox';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router';
import { ButtonLink,
  AlertBanner, Button, Card, ErrorState, StatusBadge, Icon, LoadingState, SelectField, TextField,
 DesignSystemScope, UnsavedChangesGuard, focusFirstInvalid } from '../../../design-system';
import { ApiRequestError } from '../api/horsesApi';
import { useHorsesApi } from '../api/HorsesApiContext';
import type { ActivationStatus, HorseDetail, StableAssignment, UserSummary } from '../api/types';
import { formatDate, todayIsoDate } from '../shared/format';
import { sexLabel } from '../shared/options';
import { useBreadcrumb } from '../shared/HorseManagementLayout';
import styles from '../shared/horses.module.css';
import { AssignBoxModal } from './AssignBoxModal';
import { HorseRecordPicker } from '../shared/HorseRecordPicker';

interface Loaded {
  horse: HorseDetail;
  owners?: UserSummary[];
  assignments?: StableAssignment[];
  activation?: ActivationStatus;
  unavailable: string[];
}

type Field = 'sire' | 'dam';

/**
 * SCR-HORSE-004 Pedigree & Ownership (Figma 283:2487) — Flow 1 step 1.2, BR-04. Declares sire/dam (sent as names:
 * the contract's ref-XOR-name rule is satisfied by never sending both), links the owner and opens the Assign Stable Box
 * modal. Completing these items can activate the horse automatically (DEC-009 §1); there is no approve action.
 */
/** Design System v2 scope for this CORE-013 screen; the shared horse layout stays owner-neutral. */
export function PedigreeOwnershipPage() {
  return <DesignSystemScope><PedigreeOwnershipPageContent /></DesignSystemScope>;
}

function PedigreeOwnershipPageContent() {
  const api = useHorsesApi();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { photoUploadFailed?: boolean } };
  const rawId = useParams().id ?? '';
  const id = /^\d+$/.test(rawId) ? Number(rawId) : NaN;

  const [data, setData] = useState<Loaded>();
  const [loadError, setLoadError] = useState<string>();
  const initializedHorse = useRef<number | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [sire, setSire] = useState('');
  const [dam, setDam] = useState('');
  const [sireChoice, setSireChoice] = useState<HorseDetail>();
  const [damChoice, setDamChoice] = useState<HorseDetail>();
  const [parentPicker, setParentPicker] = useState<'sire' | 'dam'>();
  const [ownerId, setOwnerId] = useState('');
  const pending = useRef(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [boxModalOpen, setBoxModalOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  useBreadcrumb([{ label: 'Ngựa', to: '/horses' }, { label: data?.horse.name ?? 'Ngựa' }, { label: 'Phả hệ & quyền sở hữu' }]);

  const fetchAll = useCallback(async (): Promise<Loaded> => {
    if (!Number.isSafeInteger(id) || id <= 0) throw new ApiRequestError(400, 'VALIDATION_ERROR', 'Mã ngựa không hợp lệ.');
    const horse = await api.getHorse(id);
    const [owners, assignments, activation] = await Promise.allSettled([
      api.listHorseOwners(), api.listStableAssignments(id), api.getActivationStatus(id),
    ]);
    return {
      horse,
      owners: owners.status === 'fulfilled' ? owners.value.items : undefined,
      assignments: assignments.status === 'fulfilled' ? assignments.value : undefined,
      activation: activation.status === 'fulfilled' ? activation.value : undefined,
      unavailable: [
        owners.status === 'rejected' ? 'Tài khoản chủ ngựa' : null,
        assignments.status === 'rejected' ? 'Lịch sử xếp chuồng' : null,
        activation.status === 'rejected' ? 'Danh mục kích hoạt' : null,
      ].filter((item): item is string => item !== null),
    };
  }, [api, id]);

  const apply = useCallback((loaded: Loaded) => {
    const { horse } = loaded;
    setData(loaded);
    setLoadError(undefined);
    if (initializedHorse.current !== horse.id) {
      initializedHorse.current = horse.id;
      setSire(horse.pedigree.sire.name || horse.pedigree.sire.horseCode || '');
      setDam(horse.pedigree.dam.name || horse.pedigree.dam.horseCode || '');
      setSireChoice(undefined); setDamChoice(undefined); setParentPicker(undefined);
      setOwnerId('');
    }
  }, []);

  const loadFailed = (e: unknown) => {
    setLoadError(e instanceof ApiRequestError && e.status === 404 ? 'Không tìm thấy ngựa này.' : e instanceof ApiRequestError && e.status === 403 ? 'Bạn không có quyền xem ngựa này.' : 'Không tải được thông tin ngựa.');
  };

  useEffect(() => {
    let active = true;
    fetchAll().then((loaded) => active && apply(loaded), (e) => active && loadFailed(e));
    return () => {
      active = false;
    };
  }, [fetchAll, apply]);

  const load = async () => {
    setRefreshing(true);
    try { apply(await fetchAll()); } catch (e) { loadFailed(e); }
    finally { setRefreshing(false); }
  };

  if (loadError) {
    return <div className={styles.page}>
      <ErrorState title="Không có ngựa này" description={loadError} onRetry={() => { setLoadError(undefined); void load(); }} />
    </div>;
  }
  if (!data) {
    return <LoadingState label="Đang tải thông tin ngựa…" />;
  }

  const { horse, owners, assignments, activation, unavailable } = data;
  const hasOwner = horse.currentOwnerships.length > 0;
  const canSave = unavailable.length === 0 && (hasOwner || Boolean(owners?.length));
  const baseline = activation?.checklist.find((c) => c.id === 'VETERINARIAN_BASELINE');
  const baselineDone = baseline ? baseline.state === 'SATISFIED' : undefined;
  const current = horse.currentAssignment;
  const previous = assignments?.filter((a) => a.effectiveTo !== null).length;
  const facts = [horse.horseCode, horse.breed, sexLabel(horse.sex), horse.foaledDate ? `foaled ${formatDate(horse.foaledDate)}` : null].filter(Boolean).join(' · ');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || refreshing || !canSave) return;
    const missing: Partial<Record<Field, string>> = {};
    if (!sire.trim()) missing.sire = 'Nhập ngựa cha.';
    if (!dam.trim()) missing.dam = 'Nhập ngựa mẹ.';
    setErrors(missing);
    setFormError(undefined);
    if (Object.keys(missing).length > 0) { focusFirstInvalid(form.current); return; }

    pending.current = true; setSaving(true);
    try {
      // A parent that exactly matches one registered horse (name or code) is linked by record; otherwise kept as a name.
      const parent = async (name: string, existing: HorseDetail['pedigree']['sire'], selected?: HorseDetail) => {
        const value = name.trim();
        if (selected && value === selected.name) return { horseId: selected.id, name: null };
        if (existing.horseId && value === (existing.name || existing.horseCode || '')) return { horseId: existing.horseId, name: null };
        const found = (await api.listHorses({ q: value, page: 0, size: 20 })).items
          .filter((item) => item.id !== horse.id && [item.name, item.horseCode].some((text) => text?.toLowerCase() === value.toLowerCase()));
        return found.length === 1 ? { horseId: found[0].id, name: null } : { horseId: null, name: value };
      };
      await api.setPedigree(horse.id, { sire: await parent(sire, horse.pedigree.sire, sireChoice), dam: await parent(dam, horse.pedigree.dam, damChoice) });
      if (ownerId && !hasOwner) {
        await api.addOwnership(horse.id, { ownerUserId: Number(ownerId), sharePercentage: 100, effectiveFrom: todayIsoDate(), isManagingOwner: true });
      }
      // Server confirmed both writes: release the unsaved-changes guard before leaving.
      flushSync(() => setSaved(true));
      navigate('/horses/pending-activation', { state: { completedHorseId: horse.id } });
    } catch (e) {
      setFormError(e instanceof ApiRequestError ? e.message : 'Không lưu được thay đổi. Hãy thử lại.');
    } finally {
      pending.current = false; setSaving(false);
    }
  };

  // Memory-only dirty state against the loaded horse; ownership/pedigree drafts are never stored locally.
  const dirty = !saved && (sire !== (horse.pedigree.sire.name || horse.pedigree.sire.horseCode || '') || dam !== (horse.pedigree.dam.name || horse.pedigree.dam.horseCode || '')
    || Boolean(sireChoice && sireChoice.id !== horse.pedigree.sire.horseId) || Boolean(damChoice && damChoice.id !== horse.pedigree.dam.horseId)
    || Boolean(!hasOwner && ownerId));

  return (
    <form ref={form} className={styles.page} onSubmit={submit} noValidate>
      <UnsavedChangesGuard dirty={dirty} />
      <button type="button" className={styles.back} onClick={() => navigate(-1)}>{'← Quay lại'}</button>

      <div data-page-banner className={styles.titleRow}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{`Phả hệ & quyền sở hữu · ${horse.name}`}</h1>
          <p className={styles.subtitle}>{`Bước 2/2 · ${facts}`}</p>
        </div>
        <StatusBadge family="lifecycle" status={horse.lifecycle} />
      </div>

      {location.state?.photoUploadFailed && (
        <AlertBanner type="warning" title="Một số ảnh chưa được tải lên">Đã lưu ngựa. Hãy thêm lại ảnh từ hồ sơ ngựa.</AlertBanner>
      )}
      {formError && <AlertBanner feedback type="danger" title="Chưa lưu thay đổi">{formError}</AlertBanner>}
      {unavailable.length > 0 && <AlertBanner type="warning" title="Không tải được dữ liệu thiết lập ngựa">
        <p>{`Không tải được: ${unavailable.join(', ')}. Ngựa đã lưu vẫn còn. Tạm khóa lưu cho đến khi kiểm tra được dữ liệu cần thiết.`}</p>
        <Button variant="secondary" disabled={refreshing || saving} onClick={() => void load()}>{refreshing ? 'Đang thử lại…' : 'Thử lại'}</Button>
        <p><ButtonLink to={`/horses/${id}`}>Xem hồ sơ ngựa đã lưu</ButtonLink>{' · '}<ButtonLink to="/horses">Quay lại danh sách ngựa</ButtonLink></p>
      </AlertBanner>}

      <div className={styles.twoCol}>
        <div className={styles.colMain}>
          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Phả hệ</h2>
              <div className={styles.row}>
                <div className={styles.parentField}><TextField label="Ngựa cha *" value={sire} maxLength={150} error={errors.sire} disabled={saving}
                  helperText={sireChoice ? `Đã chọn hồ sơ ${sireChoice.horseCode}. Sửa tên sẽ bỏ lựa chọn này.` : 'Nhập tên ngựa ngoài hệ thống hoặc chọn hồ sơ đã có.'}
                  onChange={(e) => { setSire(e.target.value); setSireChoice(undefined); setErrors((x) => ({ ...x, sire: undefined })); }} />
                  <Button variant="secondary" size="sm" disabled={saving} onClick={() => setParentPicker('sire')}>Chọn ngựa cha có hồ sơ</Button></div>
                <div className={styles.parentField}><TextField label="Ngựa mẹ *" value={dam} maxLength={150} error={errors.dam} disabled={saving}
                  helperText={damChoice ? `Đã chọn hồ sơ ${damChoice.horseCode}. Sửa tên sẽ bỏ lựa chọn này.` : 'Nhập tên ngựa ngoài hệ thống hoặc chọn hồ sơ đã có.'}
                  onChange={(e) => { setDam(e.target.value); setDamChoice(undefined); setErrors((x) => ({ ...x, dam: undefined })); }} />
                  <Button variant="secondary" size="sm" disabled={saving} onClick={() => setParentPicker('dam')}>Chọn ngựa mẹ có hồ sơ</Button></div>
              </div>
            </div>
          </Card>

          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Quyền sở hữu</h2>
              <p className={styles.cardHelp}>Chủ ngựa xem ngựa này ở chế độ chỉ đọc trong cổng Horse Owner — chủ ngựa không sửa được dữ liệu quản lý.</p>
              {hasOwner ? <p>Chủ ngựa hiện tại: <strong>{horse.currentOwnerships.map(({ owner }) => owner.fullName).join(', ')}</strong></p> :
              <SelectField label="Chủ ngựa" placeholder="Chưa khai báo chủ ngựa" value={ownerId}
                disabled={!owners || saving || refreshing}
                helperText={owners ? (owners.length ? 'Người được chọn sẽ là chủ ngựa. Có thể khai báo sau, trước khi kích hoạt.' : 'Chưa có tài khoản Horse Owner nào đang hoạt động. Hãy liên hệ Club Manager.') : 'Không tải được tài khoản chủ ngựa. Hãy tải lại dữ liệu thiết lập.'}
                options={(owners ?? []).map((o) => ({ value: String(o.id), label: `${o.fullName} · tài khoản Horse Owner` }))}
                onChange={(e) => setOwnerId(e.target.value)} />}
            </div>
          </Card>

          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Ô chuồng</h2>
              <p className={styles.cardHelp}>Bắt buộc trước khi kích hoạt. Chỉ xếp được ô còn trống.</p>
              <div className={styles.boxRow}>
                <div className={styles.boxValue}>
                  <span className={styles.boxValueMain}>{current ? `${boxLabel(current.boxCode)}${current.yard ? ` · ${yardLabel(current.yard)}` : ''}` : 'Chưa xếp ô chuồng'}</span>
                  <span className={styles.boxValueSub}>
                    {previous === undefined ? 'Không tải được lịch sử ô chuồng' : previous === 0 ? (current ? `Xếp ngày ${formatDate(current.effectiveFrom)}` : 'Lịch sử ô chuồng: chưa có — ngựa mới đến')
                      : `Lịch sử ô chuồng: ${previous} ô trước đây`}
                  </span>
                </div>
                <Button variant="secondary" disabled={saving || refreshing} onClick={() => setBoxModalOpen(true)}>Xếp ô chuồng</Button>
              </div>
            </div>
          </Card>
        </div>

        <aside className={styles.colSide}>
          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Tóm tắt ngựa</h2>
              <div className={styles.kv}><span className={styles.kvLabel}>Ngựa</span><span className={styles.kvValue}>{`${horse.name} · ${horse.horseCode}`}</span></div>
              <div className={styles.kv}><span className={styles.kvLabel}>Giống · giới tính</span><span className={styles.kvValue}>{[horse.breed, sexLabel(horse.sex)].filter(Boolean).join(' · ') || '—'}</span></div>
              <div className={styles.kv}><span className={styles.kvLabel}>Vòng đời</span><StatusBadge family="lifecycle" status={horse.lifecycle} /></div>
              <div className={styles.kv}><span className={styles.kvLabel}>Khám sức khỏe ban đầu</span>
                <span className={styles.kvValue}>{baselineDone === undefined ? 'Không tải được trạng thái khám ban đầu' : baselineDone ? 'Đã ghi (Veterinarian)' : 'Chưa ghi (Veterinarian)'}</span></div>
            </div>
          </Card>
          <div className={[styles.note, styles.notePrimary].join(' ')}>
            <Icon name="info" size={16} />
            <span>Phả hệ, chủ ngựa và ô chuồng hoàn tất hồ sơ quản lý. Ngựa giữ trạng thái Nháp cho đến khi đủ mọi yêu cầu kích hoạt — kể cả kết quả khám ban đầu của Veterinarian.</span>
          </div>
        </aside>
      </div>

      {parentPicker && <HorseRecordPicker api={api} kind={parentPicker} horseId={horse.id} onClose={() => setParentPicker(undefined)}
        otherParentId={parentPicker === 'sire'
          ? damChoice?.id ?? (dam === (horse.pedigree.dam.name || horse.pedigree.dam.horseCode) ? horse.pedigree.dam.horseId ?? undefined : undefined)
          : sireChoice?.id ?? (sire === (horse.pedigree.sire.name || horse.pedigree.sire.horseCode) ? horse.pedigree.sire.horseId ?? undefined : undefined)}
        onSelected={selected => {
          if (parentPicker === 'sire') { setSire(selected.name); setSireChoice(selected); }
          else { setDam(selected.name); setDamChoice(selected); }
          setErrors(current => ({ ...current, [parentPicker]: undefined })); setParentPicker(undefined);
        }} />}
      <div className={styles.footer}>
        <Button variant="secondary" onClick={() => navigate('/horses')} disabled={saving}>Hủy</Button>
        <Button type="submit" disabled={saving || refreshing || !canSave}>{'Lưu & tiếp tục'}</Button>
      </div>

      {boxModalOpen && (
        <AssignBoxModal open horse={horse} onClose={() => setBoxModalOpen(false)}
          onAssigned={() => { setBoxModalOpen(false); void load(); }} />
      )}
    </form>
  );
}
