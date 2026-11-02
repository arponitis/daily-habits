/* Daily Habits — js/app/templates-ui.js
 * Habit templates UI: the Templates card in More (browse + one-tap apply).
 *
 * Classic script (no build step): top-level functions and vars are global
 * so inline onclick handlers keep working. Loaded after js/lib/* and the
 * store/sync clients; see ARCHITECTURE.md.
 */
'use strict';

var expandedTemplate = null;         // template id expanded in the Templates card

function templatesCardHtml() {
  var html = '<div class="card"><h2>Templates</h2><p class="hint">One-tap starter packs — pick the habits you want.</p>';
  html += DH.listTemplates().map(function (t) {
    var open = expandedTemplate === t.id;
    var head = '<button type="button" class="tpl-head" onclick="toggleTemplate(\'' + t.id + '\')" aria-expanded="' + open + '">' +
      '<span class="m-ico">' + esc(t.icon) + '</span>' +
      '<span class="m-name">' + esc(t.name) + ' <small>' + t.habitCount + ' habits · ' + esc(t.blurb) + '</small></span>' +
      '<span class="tpl-caret">' + (open ? '▾' : '▸') + '</span></button>';
    var body = '';
    if (open) {
      body = '<div class="tpl-body">' + t.habits.map(function (h, i) {
        return '<label class="tpl-row"><input type="checkbox" data-tpl="' + t.id + '" value="' + i + '" checked> ' +
          '<span class="m-ico">' + esc(h.icon) + '</span><span>' + esc(h.name) +
          ' <small>' + esc(DH.scheduleLabel(h.schedule)) + '</small></span></label>';
      }).join('') +
      '<div class="btn-row"><button type="button" class="btn ghost" onclick="applyTemplate(\'' + t.id + '\')">Add selected</button></div></div>';
    }
    return '<div class="tpl">' + head + body + '</div>';
  }).join('');
  return html + '</div>';
}

function toggleTemplate(id) { expandedTemplate = expandedTemplate === id ? null : id; render(); }

function applyTemplate(id) {
  var boxes = document.querySelectorAll('input[data-tpl="' + id + '"]:checked');
  var idx = [];
  for (var i = 0; i < boxes.length; i++) idx.push(parseInt(boxes[i].value, 10));
  if (!idx.length) { showToast('Select at least one habit.'); return; }
  var habits = DH.instantiateTemplate(id, idx, state.habits.map(function (h) { return h.id; }), Date.now());
  if (!habits || !habits.length) return;
  habits.forEach(function (h) { state.habits.push(h); });
  saveState();
  expandedTemplate = null;
  showToast('Added ' + habits.length + ' habit' + (habits.length === 1 ? '' : 's') + ' 🎉');
  if (onboardingStep === 'templates') completeOnboarding();
  else render();
}
