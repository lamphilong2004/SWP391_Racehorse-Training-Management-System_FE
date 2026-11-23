import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

configure({ asyncUtilTimeout: 5000 });

// Unit tests never reach a real server; each test stubs fetch itself. Without this default, a request that is still
// running after its test ended (the tree is unmounted and vi.unstubAllGlobals() restored fetch) goes to
// http://localhost:8080. When a local backend runs there it answers 401, and the old AuthProvider then clears the shared
// session of the next test ("Đăng nhập lại…"). The result depended on whether a backend was running on the machine.
// vi.unstubAllGlobals() restores this function, not the real fetch.
globalThis.fetch = (() => Promise.reject(new TypeError('fetch failed: unit tests must not reach the network'))) as typeof fetch;

afterEach(() => {
  cleanup();
});

// jsdom does not implement the modal part of <dialog>; emulate open/close so Modal and Drawer can be tested.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}
