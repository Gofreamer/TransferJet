const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root } = require('./helpers.cjs');

test('todos os arquivos JavaScript são válidos e scripts locais do HTML existem', () => {
  const files = fs.readdirSync(path.join(root, 'js'), { recursive: true }).filter(f => f.endsWith('.js'));
  for (const file of files) new vm.Script(fs.readFileSync(path.join(root, 'js', file), 'utf8'), { filename: file });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const [, src] of html.matchAll(/<script src="(\.\/[^\"]+)"/g)) assert.ok(fs.existsSync(path.join(root, src)), src);
});
