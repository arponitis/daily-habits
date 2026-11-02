/* Daily Habits — js/lib/templates.js
 * Habit starter-pack templates (Morning Reset, Deep Work, Fitness Starter, Reading).
 *
 * Part of the DH pure-logic layer: no DOM, no I/O. Each module adds its
 * public functions to globalThis.DH; cross-module calls go through DH.
 * Loaded as classic scripts (no build step); see ARCHITECTURE.md.
 */
(function () {
  'use strict';
  var DH = (globalThis.DH = globalThis.DH || {});

  var TEMPLATES = [
    { id: 'morning-reset', name: 'Morning Reset', icon: '🌅',
      blurb: 'Own the first hour of the day.',
      habits: [
        { name: 'Make bed', icon: '🛌', schedule: { type: 'daily' }, description: 'Two minutes, done.' },
        { name: 'Drink a glass of water', icon: '💧', schedule: { type: 'daily' }, description: 'Before coffee.' },
        { name: '10-minute tidy', icon: '🧹', schedule: { type: 'daily' }, description: 'One room, ten minutes.' }
      ] },
    { id: 'deep-work', name: 'Deep Work', icon: '🧠',
      blurb: 'Protect your attention.',
      habits: [
        { name: 'No phone first hour', icon: '📵', schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] }, description: 'Phone stays in another room.' },
        { name: 'Two focus blocks', icon: '🧠', schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] }, description: '50 minutes each, no notifications.' },
        { name: 'Write 200 words', icon: '📝', schedule: { type: 'daily' }, description: 'Anything. Just ship words.' }
      ] },
    { id: 'fitness-starter', name: 'Fitness Starter', icon: '🏃',
      blurb: 'Small moves, every day.',
      habits: [
        { name: 'Walk 20 minutes', icon: '🏃', schedule: { type: 'daily' }, description: 'Around the block counts.' },
        { name: 'Stretch 5 minutes', icon: '💪', schedule: { type: 'daily' }, description: 'Hips and shoulders.' },
        { name: 'No sugary drinks', icon: '🚫', schedule: { type: 'daily' }, description: 'Water, tea, or black coffee.' }
      ] },
    { id: 'reading', name: 'Reading', icon: '📖',
      blurb: 'Twenty pages a day.',
      habits: [
        { name: 'Read 20 pages', icon: '📖', schedule: { type: 'daily' }, description: 'Paper or e-ink, not a feed.' },
        { name: 'Journal 5 minutes', icon: '📝', schedule: { type: 'daily' }, description: 'One honest paragraph.' }
      ] }
  ];

  function listTemplates() {
    return TEMPLATES.map(function (t) {
      return {
        id: t.id, name: t.name, icon: t.icon, blurb: t.blurb, habitCount: t.habits.length,
        habits: t.habits.map(function (h) {
          return { name: h.name, icon: h.icon, schedule: DH.normSchedule({ schedule: h.schedule }), description: h.description };
        })
      };
    });
  }

  function getTemplate(id) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === id) return TEMPLATES[i];
    return null;
  }

  function newTemplateHabitId(taken) {
    var id;
    do { id = 'h_' + Math.random().toString(36).slice(2, 10); } while (taken[id]);
    taken[id] = true;
    return id;
  }

  function instantiateTemplate(templateId, selectedIndexes, existingIds, nowMs) {
    var t = getTemplate(templateId);
    if (!t) return null;
    var taken = {};
    (existingIds || []).forEach(function (id) { taken[id] = true; });
    var now = nowMs || Date.now();
    return (selectedIndexes || []).map(function (idx) {
      var h = t.habits[idx];
      if (!h) return null;
      return {
        id: newTemplateHabitId(taken), name: h.name, icon: h.icon,
        createdAt: now, archived: false,
        schedule: DH.normSchedule({ schedule: h.schedule }),
        description: h.description || '', category: '', weeklyTarget: null
      };
    }).filter(Boolean);
  }

  DH.listTemplates = listTemplates;
  DH.getTemplate = getTemplate;
  DH.instantiateTemplate = instantiateTemplate;
})();
