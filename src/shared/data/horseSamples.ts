import { ApiError, type CurrentUser } from '../auth/authApi';
import type { HorseDetail, StableBox, ActivationStatus, HorseIdentityRequest, OwnershipRequest } from '../../features/horses/api/types';
import { readSamples, saveSamples, horse, sampleUser } from './sampleStore';

export interface HorseSampleState { records: HorseDetail[]; boxes: StableBox[]; photos: Record<number, { id: number; url: string; uploadedAt: string }[]>; baselineHorseIds: number[] }
function initialHorses(): HorseSampleState {
  const now = new Date().toISOString();
  return { records: [{ ...horse, breed: horse.breed ?? null, sex: horse.sex ?? null, foaledDate: horse.foaledDate ?? null, healthStatus: 'MONITORING', currentBoxCode: 'A-12', primaryPhotoUrl: null, countryOfOrigin: 'Ireland', registrationNo: null, activatedAt: now,
    pedigree: { sire: { horseId: null, name: 'Northern Star' }, dam: { horseId: null, name: 'Silver Mist' } }, currentOwnerships: [{ id: 101, owner: sampleUser('HORSE_OWNER'), sharePercentage: 100, effectiveFrom: now.slice(0, 10), effectiveTo: null, isManagingOwner: true }],
    currentAssignment: { id: 102, stableBoxId: 12, boxCode: 'A-12', yard: 'North Yard', effectiveFrom: now.slice(0, 10), effectiveTo: null, reason: null, assignedBy: sampleUser('CLUB_MANAGER') }, createdAt: now, updatedAt: null }],
    boxes: [{ id: 12, boxCode: 'A-12', yard: 'North Yard', status: 'OCCUPIED', currentHorse: horse }, ...[7, 8, 9].map((id): StableBox => ({ id, boxCode: `B-0${id}`, yard: 'North Yard', status: 'FREE', currentHorse: null }))], photos: {}, baselineHorseIds: [7] };
}
function activation(h: HorseDetail, state: HorseSampleState): ActivationStatus {
  const items: [ActivationStatus['checklist'][number]['item'], boolean][] = [
    ['IDENTITY', Boolean(h.name && h.horseCode && h.breed && h.sex && h.foaledDate)],
    ['PEDIGREE_AND_OWNER', Boolean((h.pedigree.sire.name || h.pedigree.sire.horseId) && (h.pedigree.dam.name || h.pedigree.dam.horseId) && h.currentOwnerships.length)],
    ['STABLE_BOX', Boolean(h.currentAssignment)], ['VET_BASELINE', state.baselineHorseIds.includes(h.id)],
  ];
  if (h.lifecycle === 'DRAFT' && items.every(([, done]) => done)) { h.lifecycle = 'ACTIVE'; h.activatedAt = new Date().toISOString(); }
  return { horseId: h.id, horseCode: h.horseCode, name: h.name, lifecycle: h.lifecycle, activatedAt: h.activatedAt,
    checklist: items.map(([item, complete]) => ({ item, complete, mandatory: true, detail: null })),
    readinessReview: { recommendation: 'RECOMMENDED', blocking: false, reviewed: false, lastReviewedAt: null, lastReviewedBy: null } };
}
export async function handleHorseSample(path: string, init: RequestInit, actor: CurrentUser): Promise<{ handled: boolean; data?: unknown }> {
  const url = new URL(path, 'http://sample.invalid');
  const route = url.pathname, method = (init.method ?? 'GET').toUpperCase();
  if (!(route === '/api/horses' || route === '/api/stable-boxes' || route === '/api/admin/users' || /^\/api\/horses\/(pending-activation|\d+(?:\/(pedigree|ownerships|photos|stable-assignments|activation-status))?)$/.test(route))) return { handled: false };
  if (!actor.roles.some((role) => ['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'VETERINARIAN', 'GROOM'].includes(role))) throw new ApiError(403, 'FORBIDDEN', 'Horse access is unavailable for your role.');
  if (method !== 'GET' || route === '/api/admin/users' || route.includes('activation')) {
    if (!actor.roles.includes('CLUB_MANAGER')) throw new ApiError(403, 'FORBIDDEN', 'Only Club Manager manages the horse register.');
  }
  const data = readSamples();
  const registry = data.horseRegistry ??= initialHorses();
  const fail = (status: number, message: string): never => { throw new ApiError(status, status === 409 ? 'CONFLICT' : status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message); };
  if (method !== 'GET' && (route === '/api/admin/users' || route === '/api/stable-boxes' || route === '/api/horses/pending-activation')) fail(404, 'No sample mutation is defined for this operation.');
  const sharedHorse = registry.records.find((record) => record.id === 7);
  if (sharedHorse) sharedHorse.healthStatus = data.healthStatus;
  const result = (value: unknown) => { saveSamples(data); return { handled: true, data: structuredClone(value) }; };
  const page = <T,>(items: T[]) => { const page = Math.max(0, Number(url.searchParams.get('page')) || 0), size = Math.max(1, Number(url.searchParams.get('size')) || 50); return { items: items.slice(page * size, (page + 1) * size), page, size, totalItems: items.length, totalPages: Math.ceil(items.length / size) }; };
  const input = init.body && !(init.body instanceof FormData) ? JSON.parse(String(init.body)) : {};
  const identity = (request: HorseIdentityRequest, id?: number) => {
    if (!request.name?.trim() || !request.horseCode?.trim()) fail(400, 'Horse name and code are required.');
    if (registry.records.some((h) => h.id !== id && (h.horseCode.toLowerCase() === request.horseCode.toLowerCase() || (request.registrationNo && h.registrationNo === request.registrationNo)))) fail(409, 'Horse code or registration number is already used.');
  };
  if (route === '/api/admin/users') return result(page([sampleUser('HORSE_OWNER')]));
  if (route === '/api/stable-boxes') return result(registry.boxes.filter((b) => !url.searchParams.get('status') || b.status === url.searchParams.get('status')));
  if (route === '/api/horses/pending-activation') return result(page(registry.records.map((h) => activation(h, registry)).filter((h) => h.lifecycle === 'DRAFT')));
  if (route === '/api/horses') {
    if (method === 'GET') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      return result(page(registry.records.filter((h) => (!url.searchParams.get('lifecycle') || h.lifecycle === url.searchParams.get('lifecycle')) && (!url.searchParams.get('availability') || h.trainingAvailability === url.searchParams.get('availability')) && `${h.name} ${h.horseCode}`.toLowerCase().includes(q))));
    }
    if (method === 'POST') {
      identity(input);
      const now = new Date().toISOString();
      const record: HorseDetail = { ...input, id: data.nextId++, lifecycle: 'DRAFT', healthStatus: null, trainingAvailability: 'AVAILABLE', currentBoxCode: null, currentAssignment: null, primaryPhotoUrl: null, activatedAt: null, pedigree: { sire: { horseId: null, name: null }, dam: { horseId: null, name: null } }, currentOwnerships: [], createdAt: now, updatedAt: null };
      registry.records.push(record); return result(record);
    }
  }
  const match = route.match(/^\/api\/horses\/(\d+)(?:\/([\w-]+))?$/);
  if (!match) return { handled: false };
  const record = registry.records.find((h) => h.id === Number(match[1])) ?? fail(404, 'Horse not found in sample data.');
  const action = match[2];
  if (method === 'GET') {
    if (!action) return result(record);
    if (action === 'activation-status') return result(activation(record, registry));
    if (action === 'stable-assignments') return result(record.currentAssignment ? [record.currentAssignment] : []);
    if (action === 'ownerships') return result(record.currentOwnerships);
    if (action === 'photos') return result(registry.photos[record.id] ?? []);
  }
  if (method === 'PUT' && !action) {
    identity(input, record.id);
    Object.assign(record, { horseCode: input.horseCode, name: input.name, breed: input.breed, sex: input.sex, foaledDate: input.foaledDate, countryOfOrigin: input.countryOfOrigin, registrationNo: input.registrationNo, updatedAt: new Date().toISOString() });
    for (const session of data.sessions.filter((s) => s.session.horse.id === record.id)) Object.assign(session.session.horse, { name: record.name, horseCode: record.horseCode });
    for (const program of data.programs.filter((p) => p.horse.id === record.id)) Object.assign(program.horse, { name: record.name, horseCode: record.horseCode });
    activation(record, registry); return result(record);
  }
  if (method === 'PUT' && action === 'pedigree') {
    if (['sire', 'dam'].some((key) => input[key]?.horseId && input[key]?.name)) fail(400, 'Choose a parent reference or name, never both.');
    record.pedigree = { sire: input.sire, dam: input.dam }; activation(record, registry); return result(record);
  }
  if (method === 'POST' && action === 'ownerships') {
    const owner = input as OwnershipRequest;
    if (owner.ownerUserId !== 17 || owner.sharePercentage <= 0 || owner.sharePercentage > 100 || !owner.effectiveFrom) fail(400, 'Choose the owner, share and effective date.');
    if (record.currentOwnerships.some((o) => o.owner.id === owner.ownerUserId)) fail(409, 'This ownership already exists.');
    const relation = { id: data.nextId++, owner: sampleUser('HORSE_OWNER'), sharePercentage: owner.sharePercentage, effectiveFrom: owner.effectiveFrom, effectiveTo: null, isManagingOwner: owner.isManagingOwner };
    record.currentOwnerships.push(relation); activation(record, registry); return result(relation);
  }
  if (method === 'POST' && action === 'stable-assignments') {
    const box = registry.boxes.find((b) => b.id === input.stableBoxId);
    if (!box || box.status !== 'FREE') fail(409, 'The stable box is no longer free. Reload and choose a free box.');
    if (record.currentAssignment) fail(409, 'This horse already has an assigned box. Transfer is outside this onboarding screen.');
    box!.status = 'OCCUPIED'; box!.currentHorse = record;
    record.currentBoxCode = box!.boxCode;
    record.currentAssignment = { id: data.nextId++, stableBoxId: box!.id, boxCode: box!.boxCode, yard: box!.yard, effectiveFrom: input.effectiveFrom, effectiveTo: null, reason: input.reason ?? null, assignedBy: actor };
    activation(record, registry); return result(record.currentAssignment);
  }
  if (method === 'POST' && action === 'photos' && init.body instanceof FormData) {
    const file = init.body.get('file');
    if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) fail(400, 'Use a JPEG, PNG or WebP image up to 5 MB.');
    const image = file as File;
    const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read the selected image.')); reader.readAsDataURL(image); });
    const photo = { id: data.nextId++, url, uploadedAt: new Date().toISOString() };
    (registry.photos[record.id] ??= []).push(photo); record.primaryPhotoUrl ??= url; return result(photo);
  }
  return { handled: false };
}
