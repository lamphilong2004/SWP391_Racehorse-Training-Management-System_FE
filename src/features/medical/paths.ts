import { ROUTES } from '../../app/routePaths';

export const MEDICAL_ROUTES = {
  ...ROUTES,
  medicalCaseNew: `${ROUTES.medical}/cases/new`,
  medicalCaseDetail: `${ROUTES.medical}/cases/:caseId`,
  treatmentPlan: `${ROUTES.medical}/cases/:caseId/treatment-plan`,
} as const;
