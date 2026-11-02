/* js/lib/index.js — Node entry point for the DH pure-logic layer.
 * Requires every lib module in dependency order and re-exports the
 * merged DH namespace. Browser loads the files as classic scripts.
 */
'use strict';
globalThis.DH = globalThis.DH || {};
require('./dates.js');
require('./schedule.js');
require('./streaks.js');
require('./heatmap.js');
require('./trends.js');
require('./insights.js');
require('./crypto.js');
require('./merge.js');
require('./templates.js');
require('./schema.js');
module.exports = globalThis.DH;
