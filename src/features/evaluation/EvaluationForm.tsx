import { useEffect, useRef, useState } from 'react';
import { AlertBanner, Button, Card, RadioGroup, TextAreaField, focusFirstInvalid } from '../../design-system';
import { ApiError } from '../../shared/auth/authApi';
import { RESULT_LABELS, type EvaluationRequest, type EvaluationResult } from './models';

export function EvaluationForm({ onSave, interrupted, onPendingChange, onDirtyChange }: { onSave: (input: EvaluationRequest) => Promise<void>; interrupted: boolean; onPendingChange: (pending: boolean) => void; onDirtyChange?: (dirty: boolean) => void }) {
  const [result, setResult] = useState('');
  const [evaluatedSummary, setSummary] = useState('');
  const [evaluationNotes, setNotes] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const dirty = Boolean(result || evaluatedSummary || evaluationNotes || recommendation);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  return <form ref={form} className="evaluation-stack" noValidate onSubmit={async (event) => {
    event.preventDefault();
    if (pending.current || conflict) return;
    const issues: Record<string, string> = {};
    if (!Object.hasOwn(RESULT_LABELS, result)) issues.result = 'Hãy chọn kết quả đánh giá.';
    for (const [field, value] of Object.entries({ evaluatedSummary, evaluationNotes, recommendation })) {
      if (value.length > 2000) issues[field] = 'Tối đa 2000 ký tự.';
    }
    setErrors(issues); setFailure('');
    if (Object.keys(issues).length) { focusFirstInvalid(form.current); return; }
    pending.current = true; setSaving(true); onPendingChange(true);
    try {
      await onSave({ result: result as EvaluationResult, evaluatedSummary: evaluatedSummary.trim() || null, evaluationNotes: evaluationNotes.trim() || null, recommendation: recommendation.trim() || null });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Không lưu được. Nội dung bạn nhập vẫn được giữ; hãy thử lại.');
      if (error instanceof ApiError) {
        setErrors(Object.fromEntries(error.details.filter((detail) => detail.field).map((detail) => [detail.field!, detail.message])));
        if (error.status === 409) setConflict(true);
      }
    } finally { pending.current = false; setSaving(false); onPendingChange(false); }
  }}>
    <Card title="Đánh giá của Trainer">
      <div className="evaluation-stack">
        <RadioGroup label="Kết quả đánh giá" required options={Object.entries(RESULT_LABELS).map(([value, label]) => ({ value, label }))} value={result} onChange={setResult} error={errors.result} disabled={saving || conflict} />
        <TextAreaField label="Tóm tắt đánh giá" value={evaluatedSummary} onChange={(event) => setSummary(event.target.value)} error={errors.evaluatedSummary} disabled={saving || conflict} helperText="Không bắt buộc · tối đa 2000 ký tự" />
        <TextAreaField label="Ghi chú chuyên môn" value={evaluationNotes} onChange={(event) => setNotes(event.target.value)} error={errors.evaluationNotes} disabled={saving || conflict} helperText="Không bắt buộc · tối đa 2000 ký tự" rows={4} />
      </div>
    </Card>
    <Card title="Khuyến nghị — các buổi tập tiếp theo"><TextAreaField label="Ghi chú khuyến nghị" value={recommendation} onChange={(event) => setRecommendation(event.target.value)} error={errors.recommendation} disabled={saving || conflict} helperText="Chỉ khuyến nghị ở cấp buổi tập. Thay đổi chiến lược cần Head Trainer phê duyệt." rows={4} /></Card>
    {failure && <AlertBanner type="danger" title={failure} children={conflict ? 'Máy chủ từ chối lần gửi này. Hãy tải lại buổi tập để xem trạng thái hiện tại trước khi tiếp tục.' : 'Nội dung bạn nhập vẫn được giữ. Bạn có thể thử lại.'} />}
    <div className="evaluation-actions"><p>{interrupted ? 'Sau khi lưu, buổi tập vẫn ở trạng thái Bị gián đoạn.' : 'Sau khi lưu, buổi tập vẫn ở trạng thái Đã hoàn thành.'}</p><Button type="submit" disabled={saving || conflict}>{saving ? 'Đang lưu…' : 'Lưu đánh giá'}</Button></div>
  </form>;
}
