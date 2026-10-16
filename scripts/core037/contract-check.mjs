import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const backend = resolve(root, '../SWP391_Racehorse-Training-Management-System_BE_CORE037');

function show(repo, ref, path) {
  return execFileSync('git', ['-c', `safe.directory=${repo.replaceAll('\\', '/')}`, '-C', repo, 'show', `${ref}:${path}`], { encoding: 'utf8' });
}

function block(source, start, next) {
  const match = source.match(new RegExp(`^${start}[\\s\\S]*?(?=^${next}|$(?![\\s\\S]))`, 'm'));
  assert.ok(match, `Missing section: ${start}`);
  return match[0];
}

const medical = show(backend, 'origin/feat/CORE-006-flow3-medical-contract', 'docs/api/flow3-medical.openapi.yaml');
const shared = show(backend, 'origin/dev', 'docs/api/shared.openapi.yaml');
const controller = show(backend, 'origin/feat/CORE-035-medical-case-treatment-recovery', 'src/main/java/com/racehorse/core035/MedicalController.java');
const incidentController = show(backend, 'origin/feat/CORE-026-incident-presession-gate', 'src/main/java/com/racehorse/core026/Core026Controller.java');
const dto = show(backend, 'origin/feat/CORE-035-medical-case-treatment-recovery', 'src/main/java/com/racehorse/core035/MedicalDtos.java');
const feService = show(root, 'origin/feat/CORE-036-vet-medical-groom-ui', 'src/features/medical/service.ts');
const feModels = show(root, 'origin/feat/CORE-036-vet-medical-groom-ui', 'src/features/medical/models.ts');

export function operation(path, method) {
  const pathBlock = block(medical, `  ${path.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`, '  /api/');
  assert.match(pathBlock, new RegExp(`^    ${method}:`, 'm'), `${method.toUpperCase()} ${path} absent from CORE-006`);
}

export function schema(name, fields) {
  const source = block(medical, `    ${name}:`, '    [A-Za-z][A-Za-z0-9]*:');
  for (const field of fields) assert.match(source, new RegExp(`^        ${field}:`, 'm'), `${name}.${field} missing`);
  return source;
}

export function verify() {
  const endpoints = [
    ['/api/incidents', 'get', incidentController, '@GetMapping("/api/incidents")'],
    ['/api/incidents/{incidentId}', 'get', incidentController, '@GetMapping("/api/incidents/{incidentId}")'],
    ['/api/medical/cases', 'get', controller, '@GetMapping("/api/medical/cases")'],
    ['/api/medical/cases', 'post', controller, '@PostMapping("/api/medical/cases")'],
    ['/api/medical/cases/{caseId}', 'get', controller, '@GetMapping("/api/medical/cases/{caseId}")'],
    ['/api/medical/cases/{caseId}/examinations', 'post', controller, '@PostMapping("/api/medical/cases/{caseId}/examinations")'],
    ['/api/medical/cases/{caseId}/injuries', 'post', controller, '@PostMapping("/api/medical/cases/{caseId}/injuries")'],
    ['/api/medical/cases/{caseId}/treatment-plan', 'get', controller, '@GetMapping("/api/medical/cases/{caseId}/treatment-plan")'],
    ['/api/medical/cases/{caseId}/treatment-plan', 'put', controller, '@PutMapping("/api/medical/cases/{caseId}/treatment-plan")'],
    ['/api/medical/cases/{caseId}/re-examinations', 'post', controller, '@PostMapping("/api/medical/cases/{caseId}/re-examinations")'],
    ['/api/medical/cases/{caseId}/close', 'post', controller, '@PostMapping("/api/medical/cases/{caseId}/close")'],
    ['/api/groom/treatment-tasks', 'get', controller, '@GetMapping("/api/groom/treatment-tasks")'],
    ['/api/groom/treatment-tasks/{taskId}/complete', 'post', controller, '@PostMapping("/api/groom/treatment-tasks/{taskId}/complete")'],
  ];
  for (const [path, method, implementation, annotation] of endpoints) {
    operation(path, method);
    assert.ok(implementation.includes(annotation), `${method.toUpperCase()} ${path} absent from Backend implementation`);
  }
  schema('MedicalCaseCreateRequest', ['horseId', 'incidentId', 'reason']);
  schema('ExaminationRequest', ['symptoms', 'examinedAt', 'severity']);
  schema('InjuryRequest', ['bodyRegion', 'severity', 'recoveryStatus', 'position3d']);
  schema('TreatmentPlanRequest', ['treatmentMedicationInstructions', 'restInstructions', 'careInstructions', 'groomTasks']);
  schema('ReexaminationRequest', ['recoveryStatus', 'findings', 'examinedAt']);
  const complete = schema('TreatmentTaskCompleteRequest', []);
  assert.match(complete, /properties: \{\}/);
  assert.match(complete, /additionalProperties: false/);
  assert.match(shared, /enum: \[VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND/);
  assert.match(dto, /record CaseCreate\(@NotNull @Positive Long horseId/);
  assert.match(dto, /record PlanPut\(@NotBlank String treatmentMedicationInstructions/);
  assert.match(controller, /if \(!body\.isEmpty\(\)\)/);
  assert.match(feService, /mode: 'unavailable'/);
  assert.doesNotMatch(feService, /fetch\(/);
  assert.match(feModels, /MedicalCaseCreateRequest \{ horseId: string; incidentId\?: string/);
  assert.match(feModels, /position3d\?: \{ x: number; y: number; z: number \}/);
  assert.match(feModels, /TreatmentTaskCompleteRequest \{ completionNotes\?: string \}/);
  return endpoints.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const count = verify();
    console.log(`PASS: ${count} endpoint/method pairs and selected DTO/security invariants match checked Git references.`);
    console.log('Integration status: BLOCKED. This is a source contract check, not live FE/BE verification.');
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
