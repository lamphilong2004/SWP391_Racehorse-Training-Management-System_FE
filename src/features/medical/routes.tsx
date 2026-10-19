import { type RouteObject } from 'react-router';
import { RequireAuth } from '../../app/RequireAuth';
import { MedicalAccess } from './runtime';
import { CaseDetailPage, CaseListPage, CreateCasePage, HerdHealthPage, TreatmentPlanPage } from './pages';
import { GroomTreatmentAccess } from './GroomTasks';
import { IncidentAccess } from './Incidents';
import { MedicalSummaryAccess } from './MedicalSummary';
import { MEDICAL_ROUTES } from './paths';

/** Additive approved FE mounts. Existing baseline/restriction implementations remain with their owners. */
export function medicalRoutes(): RouteObject[] {
  return [
    { path: MEDICAL_ROUTES.incidents, element: <RequireAuth><IncidentAccess /></RequireAuth> },
    { path: `${MEDICAL_ROUTES.incidents}/:incidentId`, element: <RequireAuth><IncidentAccess detail /></RequireAuth> },
    { path: MEDICAL_ROUTES.medical, element: <RequireAuth><MedicalAccess><CaseListPage /></MedicalAccess></RequireAuth> },
    { path: MEDICAL_ROUTES.medicalCaseNew, element: <RequireAuth><MedicalAccess><CreateCasePage /></MedicalAccess></RequireAuth> },
    { path: MEDICAL_ROUTES.medicalCaseDetail, element: <RequireAuth><MedicalAccess><CaseDetailPage /></MedicalAccess></RequireAuth> },
    { path: MEDICAL_ROUTES.treatmentPlan, element: <RequireAuth><MedicalAccess><TreatmentPlanPage /></MedicalAccess></RequireAuth> },
    { path: MEDICAL_ROUTES.herdHealth, element: <RequireAuth><MedicalAccess><HerdHealthPage /></MedicalAccess></RequireAuth> },
    { path: MEDICAL_ROUTES.medicalSummary, element: <RequireAuth><MedicalSummaryAccess /></RequireAuth> },
    { path: MEDICAL_ROUTES.careTasks, element: <RequireAuth><GroomTreatmentAccess /></RequireAuth> },
  ];
}
