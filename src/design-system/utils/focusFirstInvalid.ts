/**
 * UX Playbook v2.1 §2: after validation, move focus to the first invalid control (fields set aria-invalid).
 * Runs after React commits the error state.
 */
export function focusFirstInvalid(root: ParentNode | null | undefined) {
  requestAnimationFrame(() => {
    root?.querySelector<HTMLElement>('input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"]')?.focus();
  });
}
