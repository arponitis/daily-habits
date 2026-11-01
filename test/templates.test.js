const { test } = require('node:test');
const assert = require('node:assert/strict');
const DH = require('../lib.js');

test('listTemplates returns 4 packs with summaries', () => {
  const ts = DH.listTemplates();
  assert.equal(ts.length, 4);
  const ids = ts.map((t) => t.id).sort();
  assert.deepEqual(ids, ['deep-work', 'fitness-starter', 'morning-reset', 'reading']);
  ts.forEach((t) => {
    assert.ok(t.name && t.icon && t.blurb);
    assert.equal(t.habitCount, t.habits.length);
    assert.ok(t.habitCount >= 2);
    t.habits.forEach((h) => {
      assert.ok(h.name && h.icon);
      assert.equal(h.schedule.type === 'daily' || h.schedule.type === 'weekdays', true);
    });
  });
});

test('getTemplate finds by id, null otherwise', () => {
  assert.equal(DH.getTemplate('reading').name, 'Reading');
  assert.equal(DH.getTemplate('nope'), null);
});

test('instantiateTemplate builds habits with unique ids', () => {
  const hs = DH.instantiateTemplate('morning-reset', [0, 1, 2], [], 1234);
  assert.equal(hs.length, 3);
  const ids = hs.map((h) => h.id);
  assert.equal(new Set(ids).size, 3);
  assert.ok(ids.every((id) => id.startsWith('h_')));
  hs.forEach((h) => {
    assert.equal(h.createdAt, 1234);
    assert.equal(h.archived, false);
    assert.equal(h.weeklyTarget, null);
  });
  assert.equal(hs[0].schedule.type, 'daily');
});

test('instantiateTemplate avoids colliding with existing ids', () => {
  const existing = ['h_abc', 'h_def'];
  const hs = DH.instantiateTemplate('reading', [0, 1], existing, 0);
  hs.forEach((h) => assert.ok(!existing.includes(h.id)));
});

test('instantiateTemplate skips bad indexes, null on unknown template', () => {
  const hs = DH.instantiateTemplate('reading', [0, 99, -1], [], 0);
  assert.equal(hs.length, 1);
  assert.equal(DH.instantiateTemplate('nope', [0], [], 0), null);
  assert.deepEqual(DH.instantiateTemplate('reading', [], [], 0), []);
});

test('template weekday schedules normalize with days', () => {
  const hs = DH.instantiateTemplate('deep-work', [0], [], 0);
  assert.equal(hs[0].schedule.type, 'weekdays');
  assert.deepEqual(hs[0].schedule.days, [1, 2, 3, 4, 5]);
});
