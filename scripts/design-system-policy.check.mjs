import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

// Read actual CSS: Vitest's default CSS stub is deliberately not used for color evidence.
const read = file => readFileSync(new URL(`../src/design-system/${file}`, import.meta.url), 'utf8');
const tokens = read('styles/tokens.css');
const v2 = tokens.split("[data-design-system='v2'] {")[1].split('}')[0];
const color = name => new RegExp(`--color-${name}: (#[0-9a-f]{6});`).exec(v2)[1];
const luminance = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
test('v1 remains default; v2 overrides only inside the single shared scope', () => {
  const legacy = tokens.slice(0, tokens.indexOf("[data-design-system='v2']"));
  assert.match(legacy, /--color-bg-page: #f7f8fa;/); assert.match(legacy, /--color-primary-600: #2f6dd9;/);
  assert.equal(color('primary-600'), '#2563eb'); assert.equal(color('brand-navy'), '#101b32');
});
test('v2 action, text and clinical badge foreground/background pairs meet 4.5:1', () => {
  for (const [a, b] of [['#ffffff', color('primary-600')], [color('text-primary'), color('bg-page')], [color('text-secondary'), color('bg-surface')], [color('simulated-text'), color('simulated-bg')], ...['success', 'warning', 'danger'].map(t => [color(`${t}-600`), color(`${t}-50`)])]) assert(ratio(a, b) >= 4.5, `Contrast ${ratio(a, b).toFixed(2)} below 4.5`);
});

test('the v2 keyboard outline outranks legacy control focus without changing v1', () => {
  const global = read('styles/global.css');
  assert.match(global, /\[data-design-system='v2'\] :focus:focus-visible \{ outline: 2px solid var\(--color-border-focus\); outline-offset: 2px; \}/);
  assert.match(read('components/Field/Field.module.css'), /\.control:focus,/);
});
test('motion has a reduced-motion escape in tokens, pending feedback and skeletons', () => {
  assert.match(tokens, /prefers-reduced-motion: reduce/);
  for (const file of ['Button/Button.module.css', 'Skeleton/Skeleton.module.css', 'Toast/ToastRegion.module.css', 'Overlay/Overlay.module.css', 'LoadingState/LoadingState.module.css']) {
    const css = read(`components/${file}`); assert.match(css, /prefers-reduced-motion: reduce/); assert.match(css, /animation: none/);
  }
});
test('responsive primitives and overlays bound narrow viewports without changing desktop widths', () => {
  assert.match(read('components/Foundation/Foundation.module.css'), /minmax\(0, 1fr\)/);
  assert.match(read('components/Foundation/Foundation.module.css'), /max-width: 767px/);
  const overlay = read('components/Overlay/Overlay.module.css'); assert.match(overlay, /width: 560px/); assert.match(overlay, /width: min\(480px, 100vw\)/); assert.match(overlay, /max-width: calc\(100vw/);
});
