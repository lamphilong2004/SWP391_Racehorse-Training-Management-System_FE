import { useEffect, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams } from 'react-router';
import { AlertBanner, Button, Card, StatusBadge, ErrorState, Icon, PhotoAttachmentTile, SelectField, TextField, DesignSystemScope, UnsavedChangesGuard, focusFirstInvalid } from '../../../design-system';
import { ApiRequestError } from '../api/horsesApi';
import { useHorsesApi } from '../api/HorsesApiContext';
import { useBreadcrumb } from '../shared/HorseManagementLayout';
import { BREED_OPTIONS, SEX_OPTIONS } from '../shared/options';
import styles from '../shared/horses.module.css';

type Field = 'name' | 'horseCode' | 'foaledDate' | 'sex' | 'breed' | 'countryOfOrigin' | 'registrationNo';
type Values = Record<Field, string>;

const EMPTY: Values = { name: '', horseCode: '', foaledDate: '', sex: '', breed: '', countryOfOrigin: '', registrationNo: '' };
const REQUIRED: Field[] = ['name', 'horseCode'];
const REQUIRED_MESSAGE: Record<string, string> = {
  name: 'Enter the horse name.', horseCode: 'Enter the horse ID.', foaledDate: 'Enter the date of birth.',
  sex: 'Select the sex.', breed: 'Select the breed.',
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
  return <DesignSystemScope><RegisterHorsePageContent /></DesignSystemScope>;
}

function RegisterHorsePageContent() {
  const api = useHorsesApi();
  const navigate = useNavigate();
  const editId = Number(useParams().id);
  const editing = Number.isSafeInteger(editId) && editId > 0;
  const [loading, setLoading] = useState(editing);
  const [loadAttempt, setLoadAttempt] = useState(0);
  useBreadcrumb([{ label: 'Horses', to: '/horses' }, { label: editing ? 'Edit identity' : 'Register Horse' }]);

  const [values, setValues] = useState<Values>(EMPTY);
  // Loaded identity in edit mode; the form is dirty only when the user changed it (memory-only, never stored).
  const [baseline, setBaseline] = useState<Values>(EMPTY);
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
    api.getHorse(editId).then((horse) => { if (active) { const loaded = { name: horse.name, horseCode: horse.horseCode, foaledDate: horse.foaledDate ?? '', sex: horse.sex ?? '', breed: horse.breed ?? '', countryOfOrigin: horse.countryOfOrigin ?? '', registrationNo: horse.registrationNo ?? '' }; setValues(loaded); setBaseline(loaded); setCustomSex(Boolean(horse.sex && !SEX_OPTIONS.some((option) => option.value === horse.sex))); setCustomBreed(Boolean(horse.breed && !BREED_OPTIONS.some((option) => option.value === horse.breed))); setLoading(false); } }, (error: unknown) => { if (active) { setFormError(error instanceof Error ? error.message : 'Horse unavailable.'); } });
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
        setFormError('The horse could not be saved. Please try again.');
      }
    } finally {
      pending.current = false; setSaving(false);
    }
  };

  const dirty = !saved && (photos.length > 0 || (Object.keys(EMPTY) as Field[]).some((field) => values[field] !== baseline[field]));

  return (
    <form ref={form} className={styles.page} onSubmit={submit} noValidate>
      <UnsavedChangesGuard dirty={dirty} />
      <button type="button" className={styles.back} onClick={() => navigate('/horses')}>{'←  Back to Horses'}</button>

      <div className={styles.titleRow}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{editing ? 'Edit Horse Identity' : 'Register Horse'}</h1>
          <p className={styles.subtitle}>{editing ? 'Administrative identity only; health and lifecycle remain server-owned.' : 'Step 1 of 2 · Identity  →  Step 2 · Pedigree, ownership and stable box'}</p>
        </div>
        <div className={styles.startsAs}>
          {!editing && <>Starts as <StatusBadge family="lifecycle" status="DRAFT" /></>}
        </div>
      </div>

      {formError && (loading ? <ErrorState title="Horse identity unavailable" description={formError} onRetry={() => { setFormError(undefined); setLoadAttempt((value) => value + 1); }} /> : <AlertBanner type="danger" title="The horse was not saved">{formError}</AlertBanner>)}
      {loading && !formError && <p role="status">Loading horse identity…</p>}

      <div className={styles.twoCol}>
        <div className={styles.colMain}>
          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Identification</h2>
              <p className={styles.cardHelp}>Name and ID are required to save a DRAFT. Complete the remaining identity information before activation.</p>
              <div className={styles.row}>
                <TextField label="Horse name *" value={values.name} onChange={(e) => set('name')(e.target.value)}
                  error={errors.name} maxLength={150} autoComplete="off" />
                <TextField label="Horse ID *" value={values.horseCode} onChange={(e) => set('horseCode')(e.target.value)}
                  error={errors.horseCode} maxLength={20} autoComplete="off" />
              </div>
              <div className={styles.row}>
                <TextField label="Date of birth" type="date" value={values.foaledDate}
                  onChange={(e) => set('foaledDate')(e.target.value)} error={errors.foaledDate} />
                <SelectField label="Sex" placeholder="Select or enter sex" options={[...SEX_OPTIONS, { value: '__CUSTOM__', label: 'Enter another value' }]} value={customSex ? '__CUSTOM__' : values.sex}
                  onChange={(e) => { setCustomSex(e.target.value === '__CUSTOM__'); set('sex')(e.target.value === '__CUSTOM__' ? '' : e.target.value); }} error={errors.sex} />
                <SelectField label="Breed" placeholder="Select or enter breed" options={[...BREED_OPTIONS, { value: '__CUSTOM__', label: 'Other / enter breed' }]} value={customBreed ? '__CUSTOM__' : values.breed}
                  onChange={(e) => { setCustomBreed(e.target.value === '__CUSTOM__'); set('breed')(e.target.value === '__CUSTOM__' ? '' : e.target.value); }} error={errors.breed} />
              </div>
              {customSex && <TextField label="Sex value" value={values.sex} maxLength={20} onChange={(event) => set('sex')(event.target.value)} />}
              {customBreed && <TextField label="Breed value" value={values.breed} maxLength={100} onChange={(event) => set('breed')(event.target.value)} />}
              <TextField label="Country of origin" placeholder="Country where the horse was foaled"
                value={values.countryOfOrigin} onChange={(e) => set('countryOfOrigin')(e.target.value)} maxLength={100} error={errors.countryOfOrigin} />
              <TextField label="Microchip / registration number" placeholder="Enter microchip or registration number"
                value={values.registrationNo} onChange={(e) => set('registrationNo')(e.target.value)} maxLength={50}
                error={errors.registrationNo} helperText="Must be unique — checked against the register when you save." />
            </div>
          </Card>

          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Photos</h2>
              <p className={styles.cardHelp}>Used on the horse profile and for identification.</p>
              <div className={styles.photoTiles}>
                {photos.map((p, i) => (
                  <PhotoAttachmentTile state="attached" key={`${p.file.name}-${i}`} fileName={p.file.name}
                    onRemove={() => removePhoto(i)} />
                ))}
                <PhotoAttachmentTile state="empty" onAdd={() => fileInput.current?.click()} />
              </div>
              <input ref={fileInput} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" multiple
                aria-label="Add photo" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
            </div>
          </Card>
        </div>

        <aside className={styles.colSide}>
          <Card>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>What happens next</h2>
              {['Save as DRAFT (this step)', 'Declare pedigree, owner and a free stable box',
                'Veterinarian records the initial health baseline',
                'The horse becomes ACTIVE automatically when the data is complete'].map((text, i) => (
                <div key={text} className={styles.step}>
                  <span className={styles.stepNum}>{i + 1}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </Card>
          <div className={[styles.note, styles.notePrimary].join(' ')}>
            <Icon name="info" size={16} />
            <span>Health Status and Training Availability are not set here — they come from the Veterinarian.</span>
          </div>
        </aside>
      </div>

      <div className={styles.footer}>
        <Button variant="secondary" onClick={() => navigate('/horses')} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || loading}>{saving ? 'Saving…' : editing ? 'Save identity' : 'Save Draft & Continue'}</Button>
      </div>
    </form>
  );
}

function labelOf(field: Field): string {
  return { name: 'Horse name', horseCode: 'Horse ID', foaledDate: 'Date of birth', sex: 'Sex', breed: 'Breed', countryOfOrigin: 'Country of origin', registrationNo: 'Number' }[field];
}
