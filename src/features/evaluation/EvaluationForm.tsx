import { useRef, useState } from 'react';
import { AlertBanner, Button, Card, RadioGroup, TextAreaField } from '../../design-system';
import { ApiError } from '../../shared/auth/authApi';
import { RESULT_LABELS, type EvaluationRequest, type EvaluationResult } from './models';

export function EvaluationForm({ onSave, interrupted, onPendingChange }: { onSave: (input: EvaluationRequest) => Promise<void>; interrupted: boolean; onPendingChange: (pending: boolean) => void }) {
  const [result, setResult] = useState('');
  const [evaluatedSummary, setSummary] = useState('');
  const [evaluationNotes, setNotes] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  return <form className="evaluation-stack" noValidate onSubmit={async (event) => {
    event.preventDefault();
    if (pending.current || conflict) return;
    const issues: Record<string, string> = {};
    if (!Object.hasOwn(RESULT_LABELS, result)) issues.result = 'Choose an assessment.';
    for (const [field, value] of Object.entries({ evaluatedSummary, evaluationNotes, recommendation })) {
      if (value.length > 2000) issues[field] = 'Use at most 2000 characters.';
    }
    setErrors(issues); setFailure('');
    if (Object.keys(issues).length) return;
    pending.current = true; setSaving(true); onPendingChange(true);
    try {
      await onSave({ result: result as EvaluationResult, evaluatedSummary: evaluatedSummary.trim() || null, evaluationNotes: evaluationNotes.trim() || null, recommendation: recommendation.trim() || null });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Unable to save. Your input is kept; please retry.');
      if (error instanceof ApiError) {
        setErrors(Object.fromEntries(error.details.filter((detail) => detail.field).map((detail) => [detail.field!, detail.message])));
        if (error.status === 409) setConflict(true);
      }
    } finally { pending.current = false; setSaving(false); onPendingChange(false); }
  }}>
    <Card title="Trainer evaluation">
      <div className="evaluation-stack">
        <RadioGroup label="Assessment" required options={Object.entries(RESULT_LABELS).map(([value, label]) => ({ value, label }))} value={result} onChange={setResult} error={errors.result} disabled={saving || conflict} />
        <TextAreaField label="Evaluation summary" value={evaluatedSummary} onChange={(event) => setSummary(event.target.value)} error={errors.evaluatedSummary} disabled={saving || conflict} helperText="Optional · at most 2000 characters" />
        <TextAreaField label="Professional notes" value={evaluationNotes} onChange={(event) => setNotes(event.target.value)} error={errors.evaluationNotes} disabled={saving || conflict} helperText="Optional under the approved API · at most 2000 characters" rows={4} />
      </div>
    </Card>
    <Card title="Recommendation — next sessions"><TextAreaField label="Recommendation note" value={recommendation} onChange={(event) => setRecommendation(event.target.value)} error={errors.recommendation} disabled={saving || conflict} helperText="Session-level recommendation only. Strategic changes require Head Trainer approval." rows={4} /></Card>
    {failure && <AlertBanner type="danger" title={failure} children={conflict ? 'The server rejected this submission. Reload the session to review its current state before continuing.' : 'Your input is kept. You can retry.'} />}
    <div className="evaluation-actions"><p>{interrupted ? 'Saving keeps this session INTERRUPTED.' : 'Saving keeps this session COMPLETED.'}</p><Button type="submit" disabled={saving || conflict}>{saving ? 'Saving…' : 'Save Evaluation'}</Button></div>
  </form>;
}
