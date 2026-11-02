/* Daily Habits — js/app/sync-ui.js
 * E2E-encrypted sync UI: the Sync card in More (endpoint, code, passphrase, manual sync).
 *
 * Classic script (no build step): top-level functions and vars are global
 * so inline onclick handlers keep working. Loaded after js/lib/* and the
 * store/sync clients; see ARCHITECTURE.md.
 */
'use strict';

function syncCardHtml() {
  if (typeof DHSync === 'undefined') return '';
  var cfg = DHSync.getConfig();
  var code = DHSync.getSyncCode();
  var st = DHSync.lastStatus;
  var statusLine = st ? esc(st.text) : (cfg.enabled ? 'Enabled — not synced yet' : 'Off');
  return '<div class="card"><h2>Sync</h2>' +
    '<p class="hint">End-to-end encrypted sync across your devices. The server only ever sees ciphertext — your passphrase never leaves this device.</p>' +
    '<div class="field"><label for="syncEndpoint">Worker URL</label>' +
    '<input id="syncEndpoint" class="text-in" inputmode="url" autocomplete="off" placeholder="https://daily-habits-sync.&lt;you&gt;.workers.dev" value="' + esc(cfg.endpoint) + '" onchange="saveSyncEndpoint(this.value)"></div>' +
    '<div class="field"><label for="syncCode">Sync code</label>' +
    '<input id="syncCode" class="text-in" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="Generate on one device, type it here on the other" value="' + esc(code) + '" onchange="saveSyncCode(this.value)"></div>' +
    '<div class="field"><label for="syncPw">Sync passphrase</label>' +
    '<input id="syncPw" type="password" class="text-in" autocomplete="new-password" placeholder="Same on every device" value="' + esc(DHSync.getPassphrase()) + '" onchange="saveSyncPassphrase(this.value)"></div>' +
    '<div class="btn-row"><button type="button" class="btn ghost" onclick="generateSyncCode()">Generate code</button>' +
    '<button type="button" class="btn ghost" onclick="copySyncCode()">Copy code</button></div>' +
    '<div style="height:10px"></div>' +
    '<div class="btn-row"><button type="button" class="btn ghost" onclick="toggleSync()">' + (cfg.enabled ? 'Disable sync' : 'Enable sync') + '</button>' +
    '<button type="button" class="btn ghost" onclick="syncNowUi()">Sync now</button></div>' +
    '<p class="hint">Status: ' + statusLine + '</p></div>';
}

function saveSyncEndpoint(v) {
  var c = DHSync.getConfig(); c.endpoint = String(v || '').trim(); DHSync.setConfig(c);
}

function saveSyncCode(v) { DHSync.setSyncCode(v); render(); }

function saveSyncPassphrase(v) { DHSync.setPassphrase(v); }

function generateSyncCode() {
  DHSync.setSyncCode(DHSync.newSyncCode(window.crypto));
  render();
}

function copySyncCode() {
  var code = DHSync.getSyncCode();
  if (!code) { showToast('No sync code yet — tap Generate code first.'); return; }
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(function () { showToast('Sync code copied!'); });
  } else {
    prompt('Copy your sync code:', code);
  }
}

function toggleSync() {
  var c = DHSync.getConfig();
  c.enabled = !c.enabled;
  if (c.enabled && !DHSync.getSyncCode()) DHSync.setSyncCode(DHSync.newSyncCode(window.crypto));
  DHSync.setConfig(c);
  if (c.enabled) DHSync.syncNowApp().then(function () { render(); });
  else render();
}

function syncNowUi() { DHSync.syncNowApp().then(function () { render(); }); }
