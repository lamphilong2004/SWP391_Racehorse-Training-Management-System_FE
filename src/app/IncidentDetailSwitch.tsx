import { useAuth } from '../shared/auth/AuthProvider';
import { MedicalAccess } from '../features/medical/runtime';
import { VetIncidentReview } from '../features/medical/pages';
import { Core046Route } from '../features/core046/auth';
import { IncidentDetailPage } from '../features/core046/pages';
import { INCIDENT_READ_ROLES } from './incidentRoles';

export function IncidentDetailSwitch() {
  const { user } = useAuth();
  if (user?.accountStatus === 'ACTIVE' && user.roles.includes('VETERINARIAN'))
    return <MedicalAccess><VetIncidentReview /></MedicalAccess>;
  return <Core046Route allowedRoles={INCIDENT_READ_ROLES}><IncidentDetailPage /></Core046Route>;
}
