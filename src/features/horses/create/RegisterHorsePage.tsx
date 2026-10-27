import { useEffect, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, StatusBadge, ErrorState, Icon, PhotoAttachmentTile, SelectField, TextField, DesignSystemScope, UnsavedChangesGuard, focusFirstInvalid } from '../../../design-system';
import { ApiRequestError } from '../api/horsesApi';
import { useHorsesApi } from '../api/HorsesApiContext';
import { useBreadcrumb } from '../shared/HorseManagementLayout';
import { BREED_OPTIONS, SEX_OPTIONS, STRENGTH_GROUPS, sexLabel, sortStrengths } from '../shared/options';
import styles from '../shared/horses.module.css';

type Field = 'name' | 'horseCode' | 'foaledDate' | 'sex' | 'breed' | 'countryOfOrigin' | 'registrationNo';
type Values = Record<Field, string>;

const EMPTY: Values = { name: '', horseCode: '', foaledDate: '', sex: '', breed: '', countryOfOrigin: '', registrationNo: '' };
const REQUIRED: Field[] = ['name', 'horseCode'];
const REQUIRED_MESSAGE: Record<string, string> = {
  name: 'Nhập tên ngựa.', horseCode: 'Nhập mã ngựa.', foaledDate: 'Nhập ngày sinh.',
  sex: 'Chọn giới tính.', breed: 'Chọn giống ngựa.',
};

interface PendingPhoto {
  file: File;
  previewUrl?: string;
}

/**
 * SCR-HORSE-003 Register Horse (Figma 282:2377) — Flow 1 step 1.1. Creates the horse in DRAFT (BR-02) through
 * POST /api/horses, then uploads the selected photos (POST /api/horses/{id}/photos, dev storage — Q-18) and continues
 * to step 2 (/horses/:id/edit). Health Status and Training Availability are never set here.
 */
/** Design System v2 scope for this CORE-013 screen; the shared horse layout stays owner-neutral. */
export function RegisterHorsePage() {
  return <DesignSystemScope data-ui-v3><RegisterHorsePageContent /></DesignSystemScope>;
}

function RegisterHorsePageContent() {
  const api = useHorsesApi();
  const navigate = useNavigate();
  const editId = Number(useParams().id);
  const editing = Number.isSafeInteger(editId) && editId > 0;
  const [loading, setLoading] = useState(editing);
  const [loadAttempt, setLoadAttempt] = useState(0);
  useBreadcrumb([{ label: 'Ngựa', to: '/horses' }, { label: editing ? 'Sửa thông tin nhận dạng' : 'Thêm ngựa' }]);

  const [values, setValues] = useState<Values>(EMPTY);
  // Loaded identity in edit mode; the form is dirty only when the user changed it (memory-only, never stored).
  const [baseline, setBaseline] = useState<Values>(EMPTY);
  const [strengths, setStrengths] = useState<string[]>([]), [baselineStrengths, setBaselineStrengths] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [customSex, setCustomSex] = useState(false), [customBreed, setCustomBreed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (!editing) return;
    let active = true;
    api.getHorse(editId).then((horse) => { if (active) { const loaded = { name: horse.name, horseCode: horse.horseCode, foaledDate: horse.foaledDate ?? '', sex: horse.sex ?? '', breed: horse.breed ?? '', countryOfOrigin: horse.countryOfOrigin ?? '', registrationNo: horse.registrationNo ?? '' }; setValues(loaded); setBaseline(loaded); const declared = sortStrengths(horse.strengths ?? []); setStrengths(declared); setBaselineStrengths(declared); setCustomSex(false); setCustomBreed(Boolean(horse.breed && !BREED_OPTIONS.some((option) => option.value === horse.breed))); setLoading(false); } }, (error: unknown) => { if (active) { setFormError(error instanceof Error ? error.message : 'Không tải được thông tin ngựa.'); } });
    return () => { active = false; };
  }, [api, editId, editing, loadAttempt]);

  const photosRef = useRef<PendingPhoto[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl)), []);

  const removePhoto = (index: number) => {
    const removed = photos[index];
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    setPhotos((all) => all.filter((_, j) => j !== index));
  };

  const set = (field: Field) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((file) => ({
      file,
      previewUrl: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined,
    }));
    setPhotos((p) => [...p, ...next]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || loading) return;
    const missing: Partial<Record<Field, string>> = {};
    for (const field of REQUIRED) {
      if (!values[field].trim()) missing[field] = REQUIRED_MESSAGE[field];
    }
    setErrors(missing);
    setFormError(undefined);
    if (Object.keys(missing).length > 0) { focusFirstInvalid(form.current); return; }

    pending.current = true; setSaving(true);
    try {
      const input = {
        horseCode: values.horseCode.trim(), name: values.name.trim(), breed: values.breed.trim() || null, sex: values.sex.trim() || null,
        foaledDate: values.foaledDate || null, countryOfOrigin: values.countryOfOrigin.trim() || null, registrationNo: values.registrationNo.trim() || null,
        strengths: sortStrengths(strengths),
      };
      const horse = editing ? await api.updateHorse(editId, input) : await api.createHorse(input);
      let photoFailed = false;
      for (const photo of photos) {
        try {
          await api.uploadPhoto(horse.id, photo.file);
        } catch {
          photoFailed = true;
        }
      }
      // Server confirmed the save: release the unsaved-changes guard before leaving.
      flushSync(() => setSaved(true));
      navigate(`/horses/${horse.id}${editing ? '' : '/edit'}`, { state: { photoUploadFailed: photoFailed } });
    } catch (e) {
      if (e instanceof ApiRequestError) {
        const fieldErrors: Partial<Record<Field, string>> = {};
        for (const d of e.details) {
          if (d.field && d.field in EMPTY) fieldErrors[d.field as Field] = e.status === 409 ? e.message : `${labelOf(d.field as Field)} ${d.message}.`;
        }
        setErrors(fieldErrors);
        if (Object.keys(fieldErrors).length === 0) setFormError(e.message); else focusFirstInvalid(form.current);
      } else {
        setFormError('Không lưu được ngựa. Hãy thử lại.');
      }
    } finally {
      pending.current = false; setSaving(false);
    }
  };

  const dirty = !saved && (photos.length > 0 || (Object.keys(EMPTY) as Field[]).some((field) => values[field] !== baseline[field])
    || sortStrengths(strengths).join() !== baselineStrengths.join());
  const toggleStrength = (code: string, checked: boolean) =>
    setStrengths((current) => checked ? [...current.filter((value) => value !== code), code] : current.filter((value) => value !== code));

  return (
    <form ref={form} className={styles.page} onSubmit={submit} noValidate>
      <UnsavedChangesGuard dirty={dirty} />
      <button type="button" className={styles.back} onClick={() => navigate('/horses')}>{'← Quay lại danh sách ngựa'}</button>

      <div className={styles.titleRow}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{editing ? 'Sửa thông tin nhận dạng ngựa' : 'Thêm ngựa'}</h1>
          <p className={styles.subtitle}>{editing ? 'Chỉ thông tin quản lý; sức khỏe và vòng đời do hệ thống quản lý.' : 'Bước 1/2 · Nhận dạng → Bước 2 · Phả hệ, quyền sở hữu và ô chuồng'}</p>
        </div>
        <div className={styles.startsAs}>
          {!editing && <>Bắt đầu ở trạng thái <StatusBadge family="lifecycle" status="DRAFT" /></>}
        </div>
      </div>

      {formError && (loading ? <ErrorState title="Không tải được thông tin nhận dạng ngựa" description={formError} onRetry={() => { setFormError(undefined); setLoadAttempt((value) => value + 1); }} /> : <AlertBanner type="danger" title="Chưa lưu được ngựa">{formError}</AlertBanner>)}
      {loading && !formError && <p role="status">Đang tải thông tin nhận dạng ngựa…</p>}

      <div className={styles.twoCol}>
        <div className={styles.colMain}>
          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Nhận dạng</h2>
              <p className={styles.cardHelp}>Cần tên và mã ngựa để lưu bản Nháp. Hoàn tất các thông tin nhận dạng còn lại trước khi kích hoạt.</p>
              <div className={styles.row}>
                <TextField label="Tên ngựa *" value={values.name} onChange={(e) => set('name')(e.target.value)}
                  error={errors.name} maxLength={150} autoComplete="off" />
                <TextField label="Mã ngựa *" value={values.horseCode} onChange={(e) => set('horseCode')(e.target.value)}
                  error={errors.horseCode} maxLength={20} autoComplete="off" />
              </div>
              <div className={styles.row}>
                <TextField label="Ngày sinh" type="date" value={values.foaledDate}
                  onChange={(e) => set('foaledDate')(e.target.value)} error={errors.foaledDate} />
                <SelectField label="Giới tính" placeholder="Chọn hoặc nhập giới tính" options={[...SEX_OPTIONS, ...(values.sex && !customSex && !SEX_OPTIONS.some((option) => option.value === values.sex) ? [{ value: values.sex, label: `${sexLabel(values.sex)} (theo dữ liệu đã lưu)` }] : []), { value: '__CUSTOM__', label: 'Nhập giá trị khác' }]} value={customSex ? '__CUSTOM__' : values.sex}
                  onChange={(e) => { setCustomSex(e.target.value === '__CUSTOM__'); set('sex')(e.target.value === '__CUSTOM__' ? '' : e.target.value); }} error={errors.sex} />
                <SelectField label="Giống ngựa" placeholder="Chọn hoặc nhập giống ngựa" options={[...BREED_OPTIONS, { value: '__CUSTOM__', label: 'Khác / nhập giống ngựa' }]} value={customBreed ? '__CUSTOM__' : values.breed}
                  onChange={(e) => { setCustomBreed(e.target.value === '__CUSTOM__'); set('breed')(e.target.value === '__CUSTOM__' ? '' : e.target.value); }} error={errors.breed} />
              </div>
              {customSex && <TextField label="Giới tính (nhập tay)" value={values.sex} maxLength={20} onChange={(event) => set('sex')(event.target.value)} />}
              {customBreed && <TextField label="Giống ngựa (nhập tay)" value={values.breed} maxLength={100} onChange={(event) => set('breed')(event.target.value)} />}
              <TextField label="Quốc gia xuất xứ" placeholder="Quốc gia nơi ngựa được sinh ra"
                value={values.countryOfOrigin} onChange={(e) => set('countryOfOrigin')(e.target.value)} maxLength={100} error={errors.countryOfOrigin} />
              <TextField label="Số vi mạch / số đăng ký" placeholder="Nhập số vi mạch hoặc số đăng ký"
                value={values.registrationNo} onChange={(e) => set('registrationNo')(e.target.value)} maxLength={50}
                error={errors.registrationNo} helperText="Phải là duy nhất — hệ thống kiểm tra khi bạn lưu." />
            </div>
          </Card>

          <Card>
            <fieldset className={[styles.cardBody, styles.strengthFieldset].join(' ')} disabled={loading}>
              <legend className={styles.cardTitle}>Thế mạnh (Club Manager khai báo)</legend>
              <p className={styles.cardHelp}>Không bắt buộc. Để trống nếu chưa rõ. Head Trainer dùng thông tin này khi chọn mẫu chương trình; đây không phải đánh giá đã xác nhận và không suy ra từ phả hệ.</p>
              <div className={styles.strengthGroups}>
                {STRENGTH_GROUPS.map((group) => (
                  <div key={group.title} role="group" aria-label={group.title} className={styles.strengthGroup}>
                    <h3 className={styles.strengthGroupTitle}>{group.title}</h3>
                    <p className={styles.cardHelp}>{group.help}</p>
                    <div className={styles.strengthChips}>
                      {group.options.map((option) => (
                        <label key={option.value} className={styles.strengthChip}>
                          <input type="checkbox" checked={strengths.includes(option.value)}
                            onChange={(event) => toggleStrength(option.value, event.target.checked)} />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Ảnh</h2>
              <p className={styles.cardHelp}>Dùng trên hồ sơ ngựa và để nhận dạng.</p>
              <div className={styles.photoTiles}>
                {photos.map((p, i) => (
                  <PhotoAttachmentTile state="attached" key={`${p.file.name}-${i}`} fileName={p.file.name}
                    onRemove={() => removePhoto(i)} />
                ))}
                <PhotoAttachmentTile state="empty" onAdd={() => fileInput.current?.click()} />
              </div>
              <input ref={fileInput} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" multiple
                aria-label="Thêm ảnh" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
            </div>
          </Card>
        </div>

        <aside className={styles.colSide}>
          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Các bước tiếp theo</h2>
              {['Lưu bản Nháp (bước này)', 'Khai báo phả hệ, chủ ngựa và một ô chuồng trống',
                'Veterinarian ghi kết quả khám sức khỏe ban đầu',
                'Ngựa tự chuyển sang Hoạt động khi đủ dữ liệu'].map((text, i) => (
                <div key={text} className={styles.step}>
                  <span className={styles.stepNum}>{i + 1}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </Card>
          <div className={[styles.note, styles.notePrimary].join(' ')}>
            <Icon name="info" size={16} />
            <span>Tình trạng sức khỏe và khả năng tập luyện không đặt ở đây — do Veterinarian quyết định.</span>
          </div>
        </aside>
      </div>

      <div className={styles.footer}>
        <Button variant="secondary" onClick={() => navigate('/horses')} disabled={saving}>Hủy</Button>
        <Button type="submit" disabled={saving || loading}>{saving ? 'Đang lưu…' : editing ? 'Lưu thông tin nhận dạng' : 'Lưu nháp & tiếp tục'}</Button>
      </div>
    </form>
  );
}

function labelOf(field: Field): string {
  return { name: 'Tên ngựa', horseCode: 'Mã ngựa', foaledDate: 'Ngày sinh', sex: 'Giới tính', breed: 'Giống ngựa', countryOfOrigin: 'Quốc gia xuất xứ', registrationNo: 'Số' }[field];
}
