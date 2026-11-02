const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('every script in index.html exists on disk', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length > 0, 'index.html should reference scripts');
  for (const src of scripts) {
    const full = path.join(ROOT, src);
    assert.ok(fs.existsSync(full), `script tag ${src} has no file on disk`);
  }
});

test('every index.html script is in the sw.js precache list', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => './' + m[1]);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const assets = sw.match(/var ASSETS = \[([\s\S]*?)\];/);
  assert.ok(assets, 'sw.js should define ASSETS');
  for (const src of scripts) {
    assert.ok(assets[1].includes(`'${src}'`), `${src} is in index.html but missing from sw.js precache`);
  }
});

test('no build step: no import/export syntax in shipped JS', () => {
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!p.includes('workers')) walk(p); }
      else if (e.name.endsWith('.js') && !e.name.endsWith('.test.js')) files.push(p);
    }
  };
  walk(path.join(ROOT, 'js'));
  assert.ok(files.length > 0);
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/^import\s/m.test(src), `${f} uses ESM import`);
    assert.ok(!/^export\s/m.test(src), `${f} uses ESM export`);
  }
});
