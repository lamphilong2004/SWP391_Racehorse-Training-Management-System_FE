import { useCallback, useEffect } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';
import { Button } from '../Button/Button';
import { Modal } from '../Overlay/Modal';

export interface UnsavedChangesGuardProps { dirty: boolean }
/** One per editable route inside a data router. Memory-only; never blocks session expiry/sign-out to /login. */
export function UnsavedChangesGuard({ dirty }: UnsavedChangesGuardProps) {
  const blocker = useBlocker(({ nextLocation }) => dirty && nextLocation.pathname !== '/login');
  useEffect(() => {
    if (!dirty && blocker.state === 'blocked') blocker.reset();
  }, [dirty, blocker]);
  useBeforeUnload(useCallback((event: BeforeUnloadEvent) => {
    if (dirty) { event.preventDefault(); event.returnValue = ''; }
  }, [dirty]));
  return <Modal open={dirty && blocker.state === 'blocked'} title="Unsaved changes" onClose={() => blocker.reset?.()}
    footer={<><Button variant="secondary" autoFocus onClick={() => blocker.reset?.()}>Continue editing</Button>
      <Button variant="danger" onClick={() => blocker.proceed?.()}>Discard changes</Button></>}>
    <p>Your changes have not been saved. Continue editing or discard them to leave this page.</p>
  </Modal>;
}
