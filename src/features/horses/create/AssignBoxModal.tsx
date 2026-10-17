import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertBanner, Button, EmptyState, ErrorState, Icon, LoadingState, Modal, SelectField, StableBoxTile } from '../../../design-system';
import { ApiRequestError } from '../api/horsesApi';
import { useHorsesApi } from '../api/HorsesApiContext';
import type { HorseLifecycle, StableAssignment, StableBox } from '../api/types';
import { todayIsoDate } from '../shared/format';
import styles from './AssignBoxModal.module.css';
import shared from '../shared/horses.module.css';

export interface AssignBoxModalProps {
  open: boolean;
  horse: { id: number; name: string; horseCode: string; lifecycle: HorseLifecycle };
  onClose: () => void;
  onAssigned: (assignment: StableAssignment) => void;
}

/**
 * SCR-HORSE-007 Assign Stable Box (Figma 284:2588) — Flow 1 step 1.2, BR-03. Shows every box of the selected yard
 * grouped by row (occupied boxes cannot be selected) and assigns the chosen free box with
 * POST /api/horses/{id}/stable-assignments. An occupied box (409) is reported from the API envelope.
 */
export function AssignBoxModal({ open, horse, onClose, onAssigned }: AssignBoxModalProps) {
  const api = useHorsesApi();
  const [boxes, setBoxes] = useState<StableBox[]>();
  const [loadError, setLoadError] = useState(false);
  const [yard, setYard] = useState<string>('');
  const [selectedId, setSelectedId] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  const apply = useCallback((all: StableBox[]) => {
    setBoxes(all);
    setYard((current) => current || all.find((b) => b.yard)?.yard || '');
  }, []);

  // Mounted only while open (see PedigreeOwnershipPage), so every opening starts with fresh state.
  useEffect(() => {
    let active = true;
    api.listStableBoxes().then((all) => active && apply(all), () => active && setLoadError(true));
    return () => {
      active = false;
    };
  }, [api, apply]);

  const reload = () => {
    setLoadError(false);
    setBoxes(undefined);
    api.listStableBoxes().then(apply, () => setLoadError(true));
  };

  const yards = useMemo(() => Array.from(new Set((boxes ?? []).map((b) => b.yard ?? ''))).filter(Boolean).sort(), [boxes]);
  const inYard = useMemo(() => (boxes ?? []).filter((b) => !yard || (b.yard ?? '') === yard), [boxes, yard]);
  const rows = useMemo(() => {
    const groups = new Map<string, StableBox[]>();
    for (const box of [...inYard].sort((a, b) => a.boxCode.localeCompare(b.boxCode, undefined, { numeric: true }))) {
      const row = box.boxCode.includes('-') ? box.boxCode.split('-')[0] : '';
      groups.set(row, [...(groups.get(row) ?? []), box]);
    }
    return [...groups.entries()];
  }, [inYard]);
  const free = inYard.filter((b) => b.status === 'FREE').length;
  const selected = boxes?.find((b) => b.id === selectedId);

  const assign = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      const assignment = await api.assignStableBox(horse.id, { stableBoxId: selected.id, effectiveFrom: todayIsoDate() });
      onAssigned(assignment);
    } catch (e) {
      setSaveError(e instanceof ApiRequestError ? e.message : 'The box could not be assigned. Please try again.');
      if (e instanceof ApiRequestError && e.status === 409) {
        setSelectedId(undefined);
        reload();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} size="lg" onClose={onClose} title={`Assign Stable Box · ${horse.name}`}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={assign} disabled={!selected || saving}>Assign Box</Button>
      </>}>
      <div className={styles.body}>
        {saveError && <AlertBanner type="danger" title="Box not assigned">{saveError}</AlertBanner>}
        {loadError && <ErrorState title="Stable boxes unavailable" description="The stable boxes could not be loaded." onRetry={reload} />}
        {!loadError && !boxes && <LoadingState label="Loading stable boxes…" />}
        {boxes && boxes.length === 0 && <EmptyState title="No stable boxes" description="No stable boxes are registered yet." />}
        {boxes && boxes.length > 0 && (
          <>
            <div className={styles.topRow}>
              {yards.length > 0 && (
                <div className={styles.yard}>
                  <SelectField label="Yard" value={yard} onChange={(e) => { setYard(e.target.value); setSelectedId(undefined); }}
                    options={yards.map((y) => ({ value: y, label: y }))} />
                </div>
              )}
              <span className={styles.spacer} />
              <span className={styles.counts}>{`${free} free · ${inYard.length - free} occupied`}</span>
            </div>
            {rows.map(([row, list]) => (
              <section key={row} className={styles.row} aria-label={row ? `Row ${row}` : 'Boxes'}>
                {row && <h3 className={styles.rowLabel}>Row {row}</h3>}
                <div className={styles.tiles}>
                  {list.map((box) => (
                    <StableBoxTile key={box.id} boxId={box.boxCode} horseName={box.currentHorse?.name}
                      state={box.status === 'OCCUPIED' ? 'occupied' : box.id === selectedId ? 'selected' : 'free'}
                      onSelect={() => box.status === 'FREE' && setSelectedId(box.id)} />
                  ))}
                </div>
              </section>
            ))}
            <div className={[shared.note, shared.notePrimary, shared.noteStrong].join(' ')} role="status">
              <Icon name="check-circle" size={16} />
              <span>
                {selected ? `${selected.boxCode} selected — free. ` : 'Select a free box. '}
                Occupied boxes cannot be selected; a box holds one horse.
              </span>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
