/**
 * Native constraint validation (required, min, max, pattern, type) shows the browser's own message, which follows
 * the browser UI language, not the page. This sets a Vietnamese message for every form control (DEC-011) without
 * touching each form; forms with their own inline validation (noValidate) never fire `invalid`, so they are unaffected.
 */
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function message(el: Control): string {
  const v = el.validity;
  if (v.valueMissing) return el instanceof HTMLSelectElement ? 'Hãy chọn một mục trong danh sách.'
    : el.type === 'checkbox' ? 'Hãy đánh dấu ô này để tiếp tục.' : el.type === 'radio' ? 'Hãy chọn một lựa chọn.' : 'Hãy nhập trường này.';
  if (v.typeMismatch) return el.type === 'email' ? 'Hãy nhập địa chỉ email hợp lệ.' : el.type === 'url' ? 'Hãy nhập đường dẫn hợp lệ.' : 'Giá trị không đúng định dạng.';
  if (v.badInput) return el.type === 'number' ? 'Hãy nhập một số.' : 'Giá trị không hợp lệ.';
  if (v.rangeUnderflow) return `Giá trị phải từ ${(el as HTMLInputElement).min} trở lên.`;
  if (v.rangeOverflow) return `Giá trị không được lớn hơn ${(el as HTMLInputElement).max}.`;
  if (v.stepMismatch) return 'Giá trị không đúng bước cho phép.';
  if (v.tooShort) return `Cần ít nhất ${(el as HTMLInputElement).minLength} ký tự.`;
  if (v.tooLong) return `Tối đa ${(el as HTMLInputElement).maxLength} ký tự.`;
  if (v.patternMismatch) return el.title || 'Giá trị không đúng định dạng yêu cầu.';
  return '';
}

const isControl = (t: EventTarget | null): t is Control =>
  t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement;

export function installNativeValidationVi(doc: Document = document): void {
  doc.addEventListener('invalid', (event) => {
    const el = event.target;
    // Only replace the browser message; a message set by the page itself (setCustomValidity) is kept.
    if (isControl(el) && !el.validity.customError) el.setCustomValidity(message(el));
  }, true);
  const clear = (event: Event) => { const el = event.target; if (isControl(el)) el.setCustomValidity(''); };
  doc.addEventListener('input', clear, true);
  doc.addEventListener('change', clear, true);
}
