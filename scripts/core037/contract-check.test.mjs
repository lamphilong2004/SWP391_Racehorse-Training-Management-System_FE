import test from 'node:test';
import assert from 'node:assert/strict';
import { operation, schema, verify } from './contract-check.mjs';

test('CORE-006 endpoint paths and methods agree with CORE-026/035 source', () => {
  assert.equal(verify(), 13);
});

test('restriction reads are contracted, but depend on CORE-019', () => {
  operation('/api/horses/{horseId}/training-availability', 'get');
  operation('/api/medical/restrictions', 'get');
  operation('/api/horses/{horseId}/medical-restrictions', 'post');
  schema('MedicalRestriction', ['level', 'reason', 'liftedAt']);
});

test('Groom completion request has no client actor or note field', () => {
  const request = schema('TreatmentTaskCompleteRequest', []);
  assert.match(request, /properties: \{\}/);
  assert.doesNotMatch(request, /completionNotes:|completedByUserId:/);
});
