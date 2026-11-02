/* Daily Habits — js/app/editor.js
 * Habit editor: add-habit form, per-habit edit sheet, archive/delete.
 *
 * Classic script (no build step): top-level functions and vars are global
 * so inline onclick handlers keep working. Loaded after js/lib/* and the
 * store/sync clients; see ARCHITECTURE.md.
 */
'use strict';

var newIcon   = EMOJI_CHOICES[3];    // default icon for the add-habit form

var newScheduleType = 'daily';       // add-habit form: daily | weekdays | timesPerWeek

var newWeekdays = [1, 2, 3, 4, 5];   // add-habit form weekday selection

var editingHabit = null;             // habit id with open editor in More tab

function newScheduleFromForm() {
  if (newScheduleType === 'weekdays') {
    return { type: 'weekdays', days: newWeekdays.slice().sort(function (a, b) { return a - b; }) };
  }
  if (newScheduleType === 'timesPerWeek') {
    var n = parseInt((document.getElementById('newTimes') || {}).value, 10);
    return { type: 'timesPerWeek', times: Math.max(1, Math.min(7, n || 3)) };
  }
  return { type: 'daily' };
}

function addHabit() {
  var input = document.getElementById('newHabitName');
  var name = (input.value || '').trim();
  if (!name) { input.focus(); return; }
  var descEl = document.getElementById('newDesc');
  var catEl = document.getElementById('newCat');
  state.habits.push({
    id: uid(), name: name, icon: newIcon, createdAt: Date.now(), archived: false,
    schedule: DH.normSchedule({ schedule: newScheduleFromForm() }),
    description: descEl ? descEl.value.trim().slice(0, 80) : '',
    category: catEl ? catEl.value.trim().slice(0, 24) : '',
    weeklyTarget: null
  });
  saveState();
  // reset the form
  newScheduleType = 'daily';
  newWeekdays = [1, 2, 3, 4, 5];
  newIcon = EMOJI_CHOICES[3];
  render();
}

function pickSchedType(el, type) {
  newScheduleType = type;
  var btns = document.querySelectorAll('#newSchedSeg .seg-btn');
  for (var i = 0; i < btns.length; i++) {
    var on = btns[i] === el;
    btns[i].classList.toggle('sel', on);
    btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  document.getElementById('newWeekdaysWrap').hidden = type !== 'weekdays';
  document.getElementById('newTimesWrap').hidden = type !== 'timesPerWeek';
}

function toggleNewWeekday(el) {
  var d = Number(el.getAttribute('data-d'));
  var i = newWeekdays.indexOf(d);
  if (i === -1) newWeekdays.push(d); else newWeekdays.splice(i, 1);
  var on = i === -1;
  el.classList.toggle('sel', on);
  el.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function pickIcon(el, icon) {
  newIcon = icon;
  var btns = document.querySelectorAll('.emoji-pick');
  for (var i = 0; i < btns.length; i++) {
    var on = btns[i] === el;
    btns[i].classList.toggle('sel', on);
    btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  el.classList.add('sel');
}

function toggleEditor(hid) { editingHabit = (editingHabit === hid) ? null : hid; render(); }

function toggleEditWeekday(el) {
  var on = !el.classList.contains('sel');
  el.classList.toggle('sel', on);
  el.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function editSchedChanged(hid) {
  var st = document.getElementById('edit-sched-' + hid).value;
  document.getElementById('edit-wdays-' + hid).hidden = st !== 'weekdays';
  document.getElementById('edit-times-' + hid).hidden = st !== 'timesPerWeek';
}

function editorHtml(h) {
  var s = DH.normSchedule(h);
  var dayBtns = ['S','M','T','W','T','F','S'].map(function (lbl, i) {
    var on = !!(s.days && s.days.indexOf(i) !== -1);
    return '<button type="button" class="day-btn' + (on ? ' sel' : '') + '" aria-pressed="' + on + '"' +
           ' data-d="' + i + '" onclick="toggleEditWeekday(this)" aria-label="' + DOW_NAMES[i] + '">' + lbl + '</button>';
  }).join('');
  return '<div class="editor">' +
    '<div class="field"><label>Name</label>' +
      '<input id="edit-name-' + h.id + '" class="text-in" maxlength="40" value="' + esc(h.name) + '"></div>' +
    '<div class="field"><label>Description</label>' +
      '<input id="edit-desc-' + h.id + '" class="text-in" maxlength="80" value="' + esc(h.description || '') + '"></div>' +
    '<div class="field"><label>Category</label>' +
      '<input id="edit-cat-' + h.id + '" class="text-in" maxlength="24" value="' + esc(h.category || '') + '"></div>' +
    '<div class="field"><label>Schedule</label>' +
      '<select id="edit-sched-' + h.id + '" class="text-in" onchange="editSchedChanged(\'' + h.id + '\')">' +
        '<option value="daily"' + (s.type === 'daily' ? ' selected' : '') + '>Daily</option>' +
        '<option value="weekdays"' + (s.type === 'weekdays' ? ' selected' : '') + '>Specific days</option>' +
        '<option value="timesPerWeek"' + (s.type === 'timesPerWeek' ? ' selected' : '') + '>Times per week</option>' +
      '</select></div>' +
    '<div class="field" id="edit-wdays-' + h.id + '"' + (s.type === 'weekdays' ? '' : ' hidden') + '>' +
      '<label>Which days</label><div class="day-pick">' + dayBtns + '</div></div>' +
    '<div class="field" id="edit-times-' + h.id + '"' + (s.type === 'timesPerWeek' ? '' : ' hidden') + '>' +
      '<label>Times per week</label>' +
      '<input id="edit-times-in-' + h.id + '" type="number" min="1" max="7" class="text-in" value="' + (s.times || 3) + '"></div>' +
    '<div class="field"><label>Weekly target <span class="opt">(optional)</span></label>' +
      '<input id="edit-target-' + h.id + '" type="number" min="1" max="21" class="text-in" ' +
        'placeholder="defaults to scheduled days" value="' + (h.weeklyTarget || '') + '"></div>' +
    '<div class="btn-row"><button type="button" class="btn" onclick="saveHabitEdit(\'' + h.id + '\')">Save</button>' +
    '<button type="button" class="btn ghost" onclick="toggleEditor(\'' + h.id + '\')">Cancel</button></div>' +
  '</div>';
}

function saveHabitEdit(hid) {
  var h = habitById(hid);
  if (!h) return;
  var val = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
  var name = val('edit-name-' + hid).trim();
  if (name) h.name = name.slice(0, 40);
  h.description = val('edit-desc-' + hid).trim().slice(0, 80);
  h.category = val('edit-cat-' + hid).trim().slice(0, 24);
  var st = val('edit-sched-' + hid);
  if (st === 'weekdays') {
    var days = [];
    var btns = document.querySelectorAll('#edit-wdays-' + hid + ' .day-btn.sel');
    for (var i = 0; i < btns.length; i++) days.push(Number(btns[i].getAttribute('data-d')));
    h.schedule = { type: 'weekdays', days: days };
  } else if (st === 'timesPerWeek') {
    var n = parseInt(val('edit-times-in-' + hid), 10);
    h.schedule = { type: 'timesPerWeek', times: Math.max(1, Math.min(7, n || 3)) };
  } else {
    h.schedule = { type: 'daily' };
  }
  h.schedule = DH.normSchedule(h);
  var t = parseInt(val('edit-target-' + hid), 10);
  h.weeklyTarget = (t > 0) ? Math.min(21, t) : null;
  editingHabit = null;
  saveState();
  render();
}

function toggleArchive(hid) {
  var h = state.habits.find(function (x) { return x.id === hid; });
  if (!h) return;
  h.archived = !h.archived;
  saveState();
  render();
}

function deleteHabit(hid) {
  var h = state.habits.find(function (x) { return x.id === hid; });
  if (!h) return;
  if (!confirm('Delete "' + h.name + '" and all its history?')) return;
  state.habits = state.habits.filter(function (x) { return x.id !== hid; });
  Object.keys(state.days).forEach(function (k) {
    if (state.days[k][hid]) delete state.days[k][hid];
    if (Object.keys(state.days[k]).length === 0) delete state.days[k];
  });
  saveState();
  render();
}
