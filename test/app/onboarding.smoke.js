/* Smoke test for #60 onboarding refresh. Run: node test/onboarding.smoke.js
   Loads lib.js + app.js with DOM stubs and drives the first-run flow. */
'use strict';
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

// ---------- stubs ----------
const ls = {};
global.localStorage = {
  getItem: k => (k in ls ? ls[k] : null),
  setItem: (k, v) => { ls[k] = String(v); },
  removeItem: k => { delete ls[k]; },
};
const written = {}; // id -> innerHTML
function mkEl(id) {
  return {
    _id: id,
    set innerHTML(v) { written[this._id] = String(v); },
    get innerHTML() { return written[this._id] || ''; },
    textContent: '',
    value: '',
    hidden: false,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, setAttribute() {}, focus() {}, click() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}
global.document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: id => mkEl(id),
  addEventListener() {},
  createElement: () => mkEl('dyn'),
  documentElement: { style: {} },
  activeElement: null,
  title: '',
};
global.window = {
  addEventListener() {}, removeEventListener() {}, scrollTo() {},
  location: { search: '', hash: '' },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
global.navigator.onLine = true; // mutate (Node 24 quirk: no reassignment)
global.setInterval = () => 0;
global.DHStore = {
  loadPersisted: async () => null,
  save() {}, flush() {}, onSaveError() {},
  readRaw: async () => null, clear: async () => {},
};
global.confirm = () => false;

// ---------- load ----------
// strip 'use strict' so top-level declarations land on globalThis for inspection
let src = fs.readFileSync('lib.js', 'utf8') + '\n' + fs.readFileSync('app.js', 'utf8');
src = src.replace(/^'use strict';/m, '');
vm.runInThisContext(src, { filename: 'app-bundle.js' });

function reset(firstRun) {
  for (const k of Object.keys(ls)) delete ls[k];
  for (const k of Object.keys(written)) delete written[k];
  globalThis.onboardingStep = null;
  globalThis.expandedTemplate = null;
  if (!firstRun) globalThis.state = globalThis.seedState();
}

setTimeout(() => {
  const G = globalThis;
  // 1. boot() ran on load with no persisted data -> choice step, empty habits
  assert.strictEqual(G.onboardingStep, 'choice', '1: onboardingStep is choice after first boot');
  assert.deepStrictEqual(G.state.habits, [], '1: habits empty on first run (no auto-seed)');
  assert.ok(!G.isOnboarded(), '1: not onboarded yet');

  // 2. choice card content
  const html = G.onboardingHtml();
  assert.ok(html.includes('Start from a template'), '2: template option');
  assert.ok(html.includes('Start blank'), '2: blank option');
  assert.ok(html.includes('Classic trio'), '2: trio option');

  // 3. template path: choice -> picker -> apply -> onboarded
  G.chooseOnboarding('template');
  assert.strictEqual(G.onboardingStep, 'templates', '3: templates step');
  const pickerHtml = G.onboardingHtml();
  assert.ok(pickerHtml.includes('Templates'), '3: picker renders in onboarding');
  assert.ok(pickerHtml.includes('Morning Reset'), '3: template packs listed');
  assert.ok(pickerHtml.includes('onboardingBack'), '3: back button present');

  // 4. trio path
  reset(true);
  G.onboardingStep = 'choice'; G.state = G.emptyState();
  G.chooseOnboarding('trio');
  assert.strictEqual(G.state.habits.length, 3, '4: trio seeds 3 habits');
  assert.strictEqual(G.onboardingStep, null, '4: onboarding complete');
  assert.ok(G.isOnboarded(), '4: onboarded flag set');

  // 5. blank path
  reset(true);
  G.onboardingStep = 'choice'; G.state = G.emptyState();
  G.chooseOnboarding('blank');
  assert.deepStrictEqual(G.state.habits, [], '5: blank = no habits');
  assert.ok(G.isOnboarded(), '5: onboarded flag set');

  // 6. tip card: shows until first check-in
  reset(true);
  G.onboardingStep = 'choice'; G.state = G.emptyState();
  G.chooseOnboarding('trio');
  assert.ok(!G.isTipSeen(), '6: tip not seen initially');
  assert.ok(!G.hasAnyCheckin(), '6: no checkins yet');
  assert.ok(G.tipCardHtml().includes('Tap a habit'), '6: tip card renders');
  const hid = G.state.habits[0].id;
  G.toggleDone(hid);
  assert.ok(G.isTipSeen(), '6: tip auto-dismissed on first check-in');
  assert.ok(G.hasAnyCheckin(), '6: checkin recorded');
  // unchecking doesn't re-show
  G.toggleDone(hid);
  assert.ok(G.isTipSeen(), '6: tip stays dismissed');

  // 7. existing user (persisted data, never onboarded): no choice card
  reset(false); // state seeded, no ONBOARD_KEY
  assert.strictEqual(G.onboardingStep, null, '7: no choice step for existing data');
  assert.ok(!G.isOnboarded(), '7: old welcome still applies');

  console.log('onboarding smoke: ALL PASS');
}, 800);
