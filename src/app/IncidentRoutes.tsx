import { Outlet } from 'react-router';
import { useAuth } from '../shared/auth/AuthProvider';
import { MedicalAccess } from '../features/medical/runtime';
import { IncidentListPage, VetIncidentReview } from '../features/medical/pages';
import { Core046Route } from '../features/core046/auth';
import { IncidentDetailPage, IncidentsPage } from '../features/core046/pages';

/** Same canonical incident routes, with existing Vet review and reporter-safe Groom views. */
export function IncidentLayout() {
  return useAuth().user?.roles.includes('VETERINARIAN')
    ? <MedicalAccess><Outlet /></MedicalAccess>
    : <Core046Route allowedRoles={['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'WORK_RIDER', 'GROOM']} />;
}
export function IncidentListRoute() {
  return useAuth().user?.roles.includes('VETERINARIAN') ? <IncidentListPage /> : <IncidentsPage />;
}
export function IncidentDetailRoute() {
  return useAuth().user?.roles.includes('VETERINARIAN') ? <VetIncidentReview /> : <IncidentDetailPage />;
}
