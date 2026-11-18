// CORE-036 — bộ dựng form dùng cho các thao tác khám/chấn thương/tái khám.
// fields mô tả từng ô: name là khóa dữ liệu, label là tên nhìn thấy, required là bắt buộc.
// initial là giá trị ban đầu; values là nội dung đang nhập trong bộ nhớ của component.
// onSave là hàm do trang cha truyền vào để gửi đúng API. File này không tự chọn endpoint.
// errors chứa lỗi theo tên trường; result là thông báo chung sau khi gửi.
// Không ghi values vào localStorage/sessionStorage vì có thể chứa dữ liệu y tế.
// Giữ state khi sửa/lỗi không đồng nghĩa khôi phục được qua refresh hay sau khi component bị gỡ.
// Muốn hiểu một form cụ thể: tìm nơi gọi <MedicalForm trong pages.tsx để xem fields/onSave.

import { clubDateTime, parseClubDateTime } from '../../shared/clubCalendar';
import { useRef, useState, type ReactNode } from 'react';
import { ActionBar, AlertBanner, Button, SelectField, TextAreaField, TextField, focusFirstInvalid } from '../../design-system';
import { medicalErrorMessage } from './errors';
import { validDate } from './groomService';
import { viLabel } from '../../shared/viLabels';

export interface FormField {
  name: string; label: string; required?: boolean; type?: string; options?: string[]; maxLength?: number;
  render?: (field: { value: string; onChange: (value: string) => void; disabled: boolean; error?: string }) => ReactNode;
}
export function MedicalForm({ fields, initial = {}, submitLabel, onSave, onCancel }: {
  fields: FormField[]; initial?: Record<string, string>; submitLabel: string;
  onSave: (values: Record<string, string>) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ error?: string; success?: string }>({});
  const [pending, setPending] = useState(false);
  // pending làm nút chuyển sang Đang lưu; submitting là khóa đồng bộ chặn nhấp đôi
  // ngay cả trước khi React kịp vẽ lại nút disabled. Cả hai được mở lại ở finally.
  const submitting = useRef(false);
  function change(name: string, value: string) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setResult({});
  }
  return <form className="medical-form" noValidate onSubmit={async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (submitting.current) return;
    // Bước 1: kiểm tra nội dung trước khi gửi. trim chỉ dùng kiểm tra khoảng trắng,
    // không xóa giá trị đang nằm trong ô. Sai một ô thì báo tại ô đó và giữ các ô khác.
    // Ngày giờ nhập được đọc theo quy ước lịch CLB; thời điểm khám không được ở tương lai
    // ngoài mức lệch đồng hồ 60 giây đang áp dụng trong code.
    const validation: Record<string, string> = {};
    fields.forEach((field) => {
      const value = values[field.name]?.trim() ?? '';
      if (field.required && !value) validation[field.name] = field.label + ' là bắt buộc';
      if (field.maxLength && value.length > field.maxLength) validation[field.name] = `${field.label} tối đa ${field.maxLength} ký tự`;
      if (field.type === 'number' && value && (!Number.isSafeInteger(Number(value)) || Number(value) < 1)) validation[field.name] = 'Nhập mã số dương';
      if (field.type === 'date' && value && !validDate(value)) validation[field.name] = 'Nhập ngày hợp lệ';
      if (field.type === 'datetime-local' && value) {
        const at = parseClubDateTime(value);
        if (!at) validation[field.name] = 'Nhập ngày giờ hợp lệ';
        else if (at.getTime() > Date.now() + 60_000) validation[field.name] = 'Không chọn thời điểm trong tương lai';
      }
      if (field.options && value && !field.options.includes(value)) validation[field.name] = 'Chọn một lựa chọn hợp lệ';
    });
    setErrors(validation); setResult({});
    // Nếu có lỗi: đưa focus đến ô sai đầu tiên và dừng, không gọi onSave.
    // Nếu hợp lệ: bước sau mới khóa gửi và chờ Backend phản hồi.
    if (Object.keys(validation).length) { focusFirstInvalid(formElement); return; }
    submitting.current = true; setPending(true);
    // await đợi toàn bộ onSave hoàn tất mới hiện Đã lưu thành công.
    // Nếu mạng/BE lỗi: catch chỉ đổi thông báo; không setValues về rỗng nên không bắt nhập lại.
    // Form này không tự reset sau thành công; việc đóng/chuyển trang phụ thuộc trang cha.
    try { await onSave(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))); setResult({ success: 'Đã lưu thành công' }); }
    catch (error) { setResult({ error: medicalErrorMessage(error, 'Không lưu được. Hãy thử lại.') }); }
    finally { submitting.current = false; setPending(false); }
  }}>
    <p className="text-caption">Điền đầy đủ các trường bắt buộc. Dữ liệu chỉ được lưu khi máy chủ xác nhận.</p>
    <div className="medical-form-fields">{fields.map((field) => <div key={field.name} className={field.type === 'textarea' ? 'medical-form-wide' : undefined}>{field.render ? field.render({ value: values[field.name] ?? '', onChange: value => change(field.name, value), disabled: pending, error: errors[field.name] }) : field.options ?
      <SelectField label={field.label} aria-label={field.label} required={field.required} options={field.options.map((value) => ({ value, label: viLabel(value) }))} placeholder="Chọn…" value={values[field.name] ?? ''} error={errors[field.name]} disabled={pending} onChange={(event) => change(field.name, event.target.value)} /> :
      field.type === 'textarea' ? <TextAreaField label={field.label} aria-label={field.label} required={field.required} maxLength={field.maxLength} value={values[field.name] ?? ''} error={errors[field.name]} disabled={pending} onChange={(event) => change(field.name, event.target.value)} /> :
      <TextField label={field.label} aria-label={field.label} required={field.required} maxLength={field.maxLength} type={field.type ?? 'text'} max={field.type === 'datetime-local' ? clubDateTime() : undefined} min={field.type === 'number' ? 1 : undefined} step={field.type === 'number' ? 1 : undefined} value={values[field.name] ?? ''} error={errors[field.name]} disabled={pending} onChange={(event) => change(field.name, event.target.value)} />}</div>)}</div>
    {result.error && <AlertBanner feedback type="danger" title={result.error} />}
    {result.success && <AlertBanner feedback type="success" title={result.success} />}
    <ActionBar>
      {onCancel && <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Hủy</Button>}
      <Button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : submitLabel}</Button>
    </ActionBar>
  </form>;
}
