// Source inventory only: it does not claim browser or persistence verification.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const tables = [];
for (const file of files('src/features').filter(p => p.endsWith('.tsx') && !p.includes('.test.'))) {
  const source = readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ['DataTable', 'table'].includes(node.tagName.getText(ast))) {
      const attr = name => node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(ast) === name)?.initializer?.getText(ast);
      tables.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        component: node.tagName.getText(ast), caption: attr('caption') ?? 'Ordered wizard phase inputs',
        filtersInModule: /TableToolbar|SelectField|type="search"|filter\(/.test(source),
        visualSystem: 'SHARED_V4', verification: 'SOURCE_INVENTORY_ONLY' });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
writeFileSync('docs/ENTERPRISE-TABLE-INVENTORY.json', JSON.stringify({ baseline: '985808c', tableInstances: tables.length,
  modules: new Set(tables.map(t => t.file)).size, caveat: 'Filters-in-module is a discovery signal, not proof of per-table functionality. Fixed comparison, phase and role catalog tables do not require arbitrary filters.', tables }, null, 2) + '\n');
console.log(`TABLE_SOURCE_INVENTORY tables=${tables.length} modules=${new Set(tables.map(t => t.file)).size}`);
