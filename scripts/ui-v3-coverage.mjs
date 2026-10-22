// Static coverage inventory, not browser or SQL evidence. Run from repository root.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
const read = path => readFileSync(path, 'utf8');
const sourceFiles = files('src').filter(path => path.endsWith('.tsx') && !/\.test\.|\/__tests__\//.test(path));
const routes = [...read('docs/UI-V3-ROUTE-INVENTORY.md').matchAll(/^\| `([^`]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/gm)]
  .map(([, path, view, guard, source]) => ({ path, view: view.trim(), guard: guard.trim(), source: source.trim(),
    visual: 'V3_DOCUMENT_SCOPE', browser: 'NOT_VERIFIED', persistence: 'NOT_VERIFIED' }));
const modules = sourceFiles.map(path => {
  const source = read(path), ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const controls = [], surfaces = [], components = [];
  const location = node => ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text)) {
      components.push({ name: node.name.text, line: location(node) });
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast), attributes = node.attributes.properties;
      const attr = name => attributes.find(item => ts.isJsxAttribute(item) && item.name.getText(ast) === name);
      const raw = name => attr(name)?.initializer?.getText(ast) ?? null;
      if (/^(Modal|Drawer|Tabs|WizardStepper|LoadingState|EmptyState|ErrorState|Skeleton|ToastRegion|UnsavedChangesGuard)$/.test(tag)) {
        surfaces.push({ tag, line: location(node), label: raw('title') ?? raw('label'),
          verification: 'SOURCE_PRESERVED; live state not implied' });
      }
      if (/^(button|Button|ButtonLink|Link|NavLink|a|form)$/.test(tag)) {
        const events = attributes.filter(item => ts.isJsxAttribute(item) && /^on[A-Z]/.test(item.name.getText(ast))).map(item => item.name.getText(ast));
        const spread = attributes.some(ts.isJsxSpreadAttribute);
        const submit = /submit/.test(raw('type') ?? '') || tag === 'form' || !!raw('form');
        const navigation = !!(raw('to') || raw('href'));
        // A button without its own handler can be a form submit, delegated click, or spread props.
        // Candidates require inspection; this static list never declares a feature broken.
        const inspect = /^(button|Button)$/.test(tag) && !events.length && !submit && !navigation && !attr('disabled') && !spread;
        controls.push({ tag, line: location(node), events, label: raw('aria-label'), type: raw('type'),
          navigation: raw('to') ?? raw('href'), disabled: raw('disabled'), delegatedOrUnhandledCandidate: inspect });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return { file: path, developmentOnly: /\/dev\/|\/staging\//.test(path), components, surfaces, controls,
    presentation: 'V3_DOCUMENT_SCOPE', functionalVerification: 'See tests and live evidence; not inferred from CSS' };
});
const css = files('src').filter(path => path.endsWith('.css')).map(path => ({ file: path,
  tokens: read(path).includes('var(--'), reducedMotion: read(path).includes('prefers-reduced-motion') }));
const report = {
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  baseline: '55f85518b7422e3cc32f8953fa3877ad6fe37ef4',
  scope: 'All existing routes; no optional routes activated. Static inventory is not E2E verification.',
  counts: { routeDeclarations: routes.length, uniquePaths: new Set(routes.map(route => route.path)).size,
    jsxModules: modules.length, uiComponents: modules.reduce((n, item) => n + item.components.length, 0),
    stateSurfaceInstances: modules.reduce((n, item) => n + item.surfaces.length, 0),
    controls: modules.reduce((n, item) => n + item.controls.length, 0), cssFiles: css.length },
  roles: ['CLUB_MANAGER', 'HEAD_TRAINER', 'TRAINER', 'WORK_RIDER', 'VETERINARIAN', 'GROOM', 'HORSE_OWNER'],
  liveGate: 'PARTIAL: Club Manager session only. Other six role sessions not provided. No business writes authorized in current database.',
  routes, modules, stylesheets: css,
};
writeFileSync('docs/UI-V3-COVERAGE.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ counts: report.counts,
  inspect: modules.flatMap(module => module.controls.filter(control => control.delegatedOrUnhandledCandidate)
    .map(control => ({ file: module.file, line: control.line, tag: control.tag }))) }, null, 2));
