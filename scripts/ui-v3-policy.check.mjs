// Entire visual migration: source-level proof that business behaviour is unchanged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const base = '55f85518b7422e3cc32f8953fa3877ad6fe37ef4';
const presentationFiles = [
  'src/layout/AppShell.tsx',
  'src/pages/LoginPage.tsx',
  'src/features/horses/HorsePages.tsx',
  'src/features/horses/create/RegisterHorsePage.tsx',
];
// Git objects use LF; this Windows checkout uses CRLF. Compare the same content
// representation before printing JSX (the printer preserves JSX text newlines).
const normalize = source => source.replace(/\r\n/g, '\n');
const read = path => normalize(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const original = path => normalize(execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' }));
function withoutVisualMarkers(source) {
  const file = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = ts.transform(file, [context => {
    const visit = node => {
      if (ts.isJsxAttributes(node)) {
        return ts.factory.updateJsxAttributes(node, node.properties.filter(attribute =>
          !ts.isJsxAttribute(attribute) || !['data-ui-v3', 'data-app-shell'].includes(attribute.name.getText(file))));
      }
      return ts.visitEachChild(node, visit, context);
    };
    return root => ts.visitNode(root, visit);
  }]);
  try { return ts.createPrinter({ removeComments: true }).printFile(result.transformed[0]); }
  finally { result.dispose(); }
}

for (const path of presentationFiles) {
  test(`${path}: only styling markers changed; actions, content, hooks and semantics preserved`, () => {
    assert.equal(withoutVisualMarkers(read(path)), withoutVisualMarkers(original(path)));
  });
}
for (const path of [
  'src/app/router.tsx', 'src/app/routePaths.ts', 'src/app/RequireAuth.tsx',
  'src/layout/navigation.ts', 'src/layout/Header.tsx', 'src/layout/Sidebar.tsx',
  'src/shared/auth/AuthProvider.tsx', 'src/shared/auth/authApi.ts',
  'src/shared/auth/authSession.ts', 'src/features/horses/api/horsesApi.ts',
  'src/shared/data/businessData.ts',
]) {
  test(`${path}: unchanged from main baseline`, () => assert.equal(read(path), original(path)));
}
test('all routes receive v3 from the document without changing route registration', () => {
  assert.match(read('index.html'), /<html lang="en" data-ui-v3>/);
  assert.match(read('src/design-system/styles/tokens.css'), /:root\[data-ui-v3\] \[data-design-system='v2'\]/);
  for (const path of presentationFiles.slice(1)) {
    assert.equal((read(path).match(/\bdata-ui-v3\b/g) || []).length, 1);
  }
  assert(!read('src/features/horses/shared/HorseManagementLayout.tsx').includes('data-ui-v3'));
});

const runtimeFiles = execFileSync('git', ['diff', '--name-only', base, '--', 'src'], { encoding: 'utf8' })
  .trim().split('\n').filter(path => /\.(tsx?|json)$/.test(path) && !/\.test\.|\/__tests__\//.test(path));
test('every existing runtime TS/TSX module preserves baseline behaviour', () => {
  for (const path of runtimeFiles) {
    assert.equal(presentationFiles.includes(path) ? withoutVisualMarkers(read(path)) : read(path),
      presentationFiles.includes(path) ? withoutVisualMarkers(original(path)) : original(path), path);
  }
  const added = execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'src'], { encoding: 'utf8' });
  assert(!added.split('\n').some(path => /\.(tsx?|json)$/.test(path) && !/\.test\.|\/__tests__\//.test(path)),
    'New runtime modules require explicit behaviour review; no hidden runtime additions');
});
test('the heading font is self-hosted with pinned dependency and no CDN import', () => {
  assert.equal(JSON.parse(read('package.json')).dependencies['@fontsource/plus-jakarta-sans'], '5.3.0');
  const css = read('src/design-system/styles/global.css');
  assert(css.includes("@import '@fontsource/plus-jakarta-sans/700.css'"));
  assert(!/https?:\/\//.test(css));
});
