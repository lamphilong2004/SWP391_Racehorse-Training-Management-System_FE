import { useEffect, useRef } from 'react';

/**
 * Opens/closes a native <dialog> as a modal (focus trap, Escape, inert background) in sync with `open`.
 * Escape and the close button both go through `onClose`, so the parent stays the single source of state.
 */
export function useModalDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    // Conditional drawers are removed rather than rendered with open=false.
    // Close the native dialog and restore its opener without stealing another overlay's focus.
    return () => {
      const active = document.activeElement;
      const restore = active === document.body || (active !== null && dialog.contains(active));
      if (dialog.open) dialog.close();
      if (restore && opener?.isConnected && !opener.matches(':disabled')) opener.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [onClose]);

  return ref;
}
