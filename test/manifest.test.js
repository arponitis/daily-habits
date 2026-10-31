const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));

test('manifest has required PWA fields', () => {
  for (const f of ['name', 'short_name', 'start_url', 'display', 'background_color', 'theme_color', 'description', 'id']) {
    assert.ok(manifest[f], 'manifest missing ' + f);
  }
  assert.equal(manifest.display, 'standalone');
});

test('manifest icons cover 192 and 512 (maskable) and files exist', () => {
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192'), 'needs a 192 icon');
  assert.ok(sizes.includes('512x512'), 'needs a 512 icon');
  assert.ok(manifest.icons.some((i) => (i.purpose || '').includes('maskable')), 'needs a maskable icon');
  for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
    assert.ok(fs.existsSync(path.join(root, f)), 'missing ' + f);
  }
});

test('manifest has a shortcuts entry', () => {
  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length > 0, 'needs at least one shortcut');
  assert.ok(manifest.shortcuts[0].url, 'shortcut needs a url');
});

test('service worker cache version is bumped', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /CACHE = 'daily-habits-v\d+'/, 'sw.js should declare a versioned cache');
});
