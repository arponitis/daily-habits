/* Daily Habits — js/app/onboarding.js
 * First-run onboarding: choice card (template / blank / classic trio) and the starter tip card.
 *
 * Classic script (no build step): top-level functions and vars are global
 * so inline onclick handlers keep working. Loaded after js/lib/* and the
 * store/sync clients; see ARCHITECTURE.md.
 */
'use strict';

var ONBOARD_KEY = 'daily-habits/onboarded';

function isOnboarded() {
  try { return !!localStorage.getItem(ONBOARD_KEY); } catch (e) { return true; }
}

function dismissWelcome() {
  try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {}
  render();
}

var onboardingStep = null; // null | 'choice' | 'templates' — first-run flow

var TIP_KEY = 'daily-habits/tip-seen';

function emptyState() {
  return { v: DH.CURRENT_SCHEMA_VERSION, habits: [], days: {} };
}

function isTipSeen() {
  try { return !!localStorage.getItem(TIP_KEY); } catch (e) { return true; }
}

function dismissTip() {
  try { localStorage.setItem(TIP_KEY, '1'); } catch (e) {}
  render();
}

function hasAnyCheckin() {
  var days = state.days || {};
  for (var k in days) {
    var d = days[k] || {};
    for (var hid in d) { if (d[hid] && d[hid].done) return true; }
  }
  return false;
}

function onboardingHtml() {
  if (onboardingStep === 'templates') {
    return '<div class="card"><button type="button" class="btn ghost" onclick="onboardingBack()">&larr; Back</button></div>' +
      templatesCardHtml();
  }
  return '<div class="card welcome"><div class="w-ico">🌱</div>' +
    '<h2>Welcome to Daily Habits</h2>' +
    '<p class="hint">How do you want to start?</p>' +
    '<div class="ob-choices">' +
    '<button type="button" class="ob-choice" onclick="chooseOnboarding(\'template\')"><span class="ob-ico">📦</span>' +
    '<span class="ob-txt"><b>Start from a template</b><small>Starter packs like Morning Reset or Deep Work</small></span></button>' +
    '<button type="button" class="ob-choice" onclick="chooseOnboarding(\'blank\')"><span class="ob-ico">📝</span>' +
    '<span class="ob-txt"><b>Start blank</b><small>Add your own habits from scratch</small></span></button>' +
    '<button type="button" class="ob-choice" onclick="chooseOnboarding(\'trio\')"><span class="ob-ico">🌱</span>' +
    '<span class="ob-txt"><b>Classic trio</b><small>Reading, Meditating, No sugar</small></span></button>' +
    '</div></div>';
}

function onboardingBack() { onboardingStep = 'choice'; render(); }

function chooseOnboarding(kind) {
  if (kind === 'template') { onboardingStep = 'templates'; render(); return; }
  state = (kind === 'trio') ? seedState() : emptyState();
  completeOnboarding();
}

function completeOnboarding() {
  try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {}
  onboardingStep = null;
  expandedTemplate = null;
  saveState();
  render();
}

function tipCardHtml() {
  return '<div class="card tip"><button type="button" class="tip-x" onclick="dismissTip()" aria-label="Dismiss tip">×</button>' +
    '<p>👆 <b>Tap a habit to check in.</b> One tap a day keeps the streak alive.</p></div>';
}

function welcomeGo() {
  dismissWelcome();
  switchTab('more');
  setTimeout(function () {
    var el = document.getElementById('newHabitName');
    if (el) el.focus();
  }, 60);
}

function welcomeHtml() {
  return '<div class="card welcome"><div class="w-ico">🌱</div>' +
    '<h2>Welcome to Daily Habits</h2>' +
    '<p class="hint">The whole system in three steps:</p>' +
    '<div class="w-steps"><div><b>1.</b> Add a small habit</div>' +
    '<div><b>2.</b> Check in once a day</div>' +
    '<div><b>3.</b> Watch the streak grow</div></div>' +
    '<div class="btn-row"><button type="button" class="btn" onclick="welcomeGo()">Add your first habit</button>' +
    '<button type="button" class="btn ghost" onclick="dismissWelcome()">Got it</button></div></div>';
}
