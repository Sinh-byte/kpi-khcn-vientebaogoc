/**
 * KPI_Config — sheet KPI_Config + API ?action=getKpiConfig|setInvalid|setAuthorRow
 * Đặt SECRET_TOKEN khớp với KPI_CONFIG_TOKEN trong user.html (hoặc để '').
 */
var KPI_CONFIG_SHEET_NAME = 'KPI_Config';
var KPI_SETTINGS_SHEET_NAME = 'KPI_Settings';
var ADMIN_AUTH_SHEET_NAME = 'Admin_Auth';
var SECRET_TOKEN = '';

function handleKpiConfigDoGet_(e) {
  // Khi "Run" thủ công trong trình sửa Apps Script, tham số e có thể undefined.
  var p = (e && e.parameter) ? e.parameter : {};
  var action = p.action || '';
  if (!action) return null;

  if (SECRET_TOKEN && (p.token || '') !== SECRET_TOKEN) {
    return jsonOut_({ ok: false, error: 'unauthorized' }, p.callback);
  }

  try {
    if (action === 'getKpiConfig') {
      return jsonOut_(getKpiConfigPayload_(p.year), p.callback);
    }
    if (action === 'getAppSettings') {
      return jsonOut_(getAppSettingsPayload_(), p.callback);
    }
    if (action === 'getAdminAuthStatus') {
      return jsonOut_(getAdminAuthStatus_(), p.callback);
    }
    if (action === 'getAnnouncements') {
      return jsonOut_(getAnnouncementsPayload_(), p.callback);
    }
    if (action === 'saveAnnouncements') {
      return jsonOut_(saveAnnouncementsFromPayload_(p.payload), p.callback);
    }
    if (action === 'getStickers') {
      return jsonOut_(getStickersPayload_(), p.callback);
    }
    if (action === 'saveStickers') {
      return jsonOut_(saveStickersFromPayload_(p.payload), p.callback);
    }
    if (action === 'setAppSetting') {
      return jsonOut_(setAppSetting_(p.key, p.value), p.callback);
    }
    if (action === 'setInvalid') {
      return jsonOut_(setInvalidRow_(p.year, p.groupKey, p.invalid === 'true' || p.invalid === '1'), p.callback);
    }
    if (action === 'setAuthorRow') {
      return jsonOut_(setAuthorRow_(
        p.year,
        p.authorRowKey,
        p.authorNoPoints === 'true' || p.authorNoPoints === '1',
        p.kOverride,
        p.hasConsensus === 'true' || p.hasConsensus === '1'
      ), p.callback);
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err.message || err) }, p.callback);
  }

  return null;
}

function jsonOut_(obj, callbackName) {
  var cb = (callbackName || '').toString().trim();
  if (cb) {
    // JSONP để tránh CORS khi gọi từ localhost/static site
    return ContentService
      .createTextOutput(cb + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getConfigSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(KPI_CONFIG_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(KPI_CONFIG_SHEET_NAME);
    sh.appendRow(['year', 'rowType', 'groupKey', 'authorRowKey', 'invalid', 'authorNoPoints', 'kOverride', 'hasConsensus', 'updatedAt']);
    sh.getRange(1, 1, 1, 9).setFontWeight('bold');
  }
  return sh;
}

function getSettingsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(KPI_SETTINGS_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(KPI_SETTINGS_SHEET_NAME);
    sh.appendRow(['key', 'value', 'updatedAt']);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  return sh;
}

function getAppSettingsPayload_() {
  var sh = getSettingsSheet_();
  var data = sh.getDataRange().getValues();
  var out = {};
  for (var i = 1; i < data.length; i++) {
    var k = (data[i][0] || '').toString().trim();
    if (!k) continue;
    out[k] = data[i][1];
  }
  return { ok: true, settings: out };
}

function setAppSetting_(keyRaw, valueRaw) {
  var key = (keyRaw || '').toString().trim();
  if (!key) return { ok: false, error: 'missing key' };
  var val = (valueRaw === undefined || valueRaw === null) ? '' : valueRaw;
  var sh = getSettingsSheet_();
  var data = sh.getDataRange().getValues();
  var now = new Date();
  for (var i = 1; i < data.length; i++) {
    if ((data[i][0] || '').toString().trim() === key) {
      sh.getRange(i + 1, 2).setValue(val);
      sh.getRange(i + 1, 3).setValue(now);
      return { ok: true };
    }
  }
  sh.appendRow([key, val, now]);
  return { ok: true };
}

function getAnnouncementsPayload_() {
  var sh = getSettingsSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if ((data[i][0] || '').toString().trim() !== 'announcements') continue;
    var raw = data[i][1];
    var txt = (raw === undefined || raw === null) ? '' : raw.toString();
    if (!txt) return { ok: true, announcements: [] };
    try {
      var parsed = JSON.parse(txt);
      return { ok: true, announcements: Array.isArray(parsed) ? parsed : [] };
    } catch (e) {
      return { ok: true, announcements: [] };
    }
  }
  return { ok: true, announcements: [] };
}

function saveAnnouncementsFromPayload_(payloadEnc) {
  var raw = (payloadEnc || '').toString();
  if (!raw) return { ok: false, error: 'missing payload' };
  var jsonStr;
  try {
    jsonStr = decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch (e1) {
    jsonStr = raw;
  }
  var arr;
  try {
    arr = JSON.parse(jsonStr);
  } catch (e2) {
    return { ok: false, error: 'invalid_json' };
  }
  if (!Array.isArray(arr)) return { ok: false, error: 'not_array' };
  var cleaned = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var id = (it.id || '').toString().trim();
    if (!id) id = 'ann_' + new Date().getTime() + '_' + i;
    var title = (it.title || '').toString();
    var body = (it.body || '').toString();
    var enabled = it.enabled === true || it.enabled === 'true' || it.enabled === 1 || it.enabled === '1';
    var createdAt = (it.createdAt || '').toString().trim();
    if (!createdAt) createdAt = new Date().toISOString();
    cleaned.push({ id: id, title: title, body: body, enabled: enabled, createdAt: createdAt });
  }
  return setAppSetting_('announcements', JSON.stringify(cleaned));
}

function getStickersPayload_() {
  var sh = getSettingsSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if ((data[i][0] || '').toString().trim() !== 'page_stickers') continue;
    var raw = data[i][1];
    var txt = (raw === undefined || raw === null) ? '' : raw.toString();
    if (!txt) return { ok: true, stickers: [] };
    try {
      var parsed = JSON.parse(txt);
      return { ok: true, stickers: Array.isArray(parsed) ? parsed : [] };
    } catch (e) {
      return { ok: true, stickers: [] };
    }
  }
  return { ok: true, stickers: [] };
}

function sanitizeStickerImageUrl_(u) {
  var s = (u || '').toString().trim();
  if (s.length > 2048) return '';
  if (s.toLowerCase().indexOf('https://') !== 0) return '';
  return s;
}

function sanitizeStickerLinkUrl_(u) {
  var s = (u || '').toString().trim();
  if (!s) return '';
  if (s.length > 2048) return '';
  if (s.charAt(0) === '#') return s;
  if (s.charAt(0) === '/') return s;
  if (s.toLowerCase().indexOf('https://') === 0) return s;
  return '';
}

function saveStickersFromArray_(arr) {
  if (!Array.isArray(arr)) return { ok: false, error: 'not_array' };
  var allowedPos = { br: true, bl: true, tr: true, tl: true };
  var cleaned = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    var id = (it.id || '').toString().trim();
    if (!id) id = 'stk_' + new Date().getTime() + '_' + i;
    var enabled0 = it.enabled === true || it.enabled === 'true' || it.enabled === 1 || it.enabled === '1';
    var stRaw = (it.stickerType || 'image').toString().trim().toLowerCase();
    var stickerType = stRaw === 'panel' ? 'panel' : 'image';
    var imageUrl = sanitizeStickerImageUrl_(it.imageUrl);
    var htmlContent = (it.htmlContent || '').toString();
    if (htmlContent.length > 48000) htmlContent = htmlContent.substring(0, 48000);
    var pbfRaw = (it.panelBodyFormat || '').toString().trim().toLowerCase();
    var panelBodyFormat = (pbfRaw === 'plain' || pbfRaw === 'text') ? 'plain' : 'html';
    if (enabled0) {
      if (stickerType === 'panel') {
        if (!htmlContent.trim()) return { ok: false, error: 'panel_empty' };
      } else {
        if (!imageUrl) return { ok: false, error: 'invalid_sticker_url' };
      }
    }
    var linkUrl = sanitizeStickerLinkUrl_(it.linkUrl);
    var pos = (it.position || 'br').toString().trim().toLowerCase();
    if (!allowedPos[pos]) pos = 'br';
    var maxW = parseInt(it.maxWidthPx, 10);
    if (stickerType === 'panel') {
      if (isNaN(maxW) || maxW < 200) maxW = 360;
      if (maxW > 920) maxW = 920;
    } else {
      if (isNaN(maxW) || maxW < 40) maxW = 120;
      if (maxW > 400) maxW = 400;
    }
    var maxH = parseInt(it.maxHeightPx, 10);
    if (isNaN(maxH) || maxH < 120) maxH = 420;
    if (maxH > 2000) maxH = 2000;
    var z = parseInt(it.zIndex, 10);
    if (isNaN(z)) z = 50;
    if (z < 1) z = 1;
    if (z > 9999) z = 9999;
    var ord = parseInt(it.order, 10);
    if (isNaN(ord)) ord = i;
    var title = (it.title || '').toString();
    var createdAt = (it.createdAt || '').toString().trim();
    if (!createdAt) createdAt = new Date().toISOString();
    cleaned.push({
      id: id,
      enabled: enabled0,
      stickerType: stickerType,
      panelBodyFormat: panelBodyFormat,
      title: title,
      imageUrl: imageUrl,
      htmlContent: htmlContent,
      linkUrl: linkUrl,
      position: pos,
      maxWidthPx: maxW,
      maxHeightPx: maxH,
      zIndex: z,
      order: ord,
      createdAt: createdAt
    });
  }
  cleaned.sort(function(a, b) {
    return (a.order || 0) - (b.order || 0);
  });
  return setAppSetting_('page_stickers', JSON.stringify(cleaned));
}

function saveStickersFromPayload_(payloadEnc) {
  var raw = (payloadEnc || '').toString();
  if (!raw) return { ok: false, error: 'missing payload' };
  var jsonStr;
  try {
    jsonStr = decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch (e1) {
    jsonStr = raw;
  }
  var arr;
  try {
    arr = JSON.parse(jsonStr);
  } catch (e2) {
    return { ok: false, error: 'invalid_json' };
  }
  return saveStickersFromArray_(arr);
}

function saveStickersFromPayloadRaw_(jsonStr) {
  var arr;
  try {
    arr = JSON.parse((jsonStr || '').toString());
  } catch (e2) {
    return { ok: false, error: 'invalid_json' };
  }
  return saveStickersFromArray_(arr);
}

function buildStickerSaveMessageHtml_(resultObj) {
  var payload = JSON.stringify({ kpi: 'saveStickers', result: resultObj });
  payload = payload.replace(/</g, '\\u003c');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><script>(function(){try{window.parent.postMessage(' + payload + ',"*");}catch(e1){}})();</script></body></html>';
}

function stickerB64ToUtf8_(b64) {
  try {
    var bytes = Utilities.base64Decode(b64);
    return Utilities.newBlob(bytes).getDataAsString();
  } catch (e1) {
    return '';
  }
}

function trySaveStickersViaFormPost_(e) {
  var p = e.parameter || {};
  if ((p.action || '').toString() !== 'saveStickersForm') return null;
  if (SECRET_TOKEN && (p.token || '') !== SECRET_TOKEN) {
    return HtmlService.createHtmlOutput(buildStickerSaveMessageHtml_({ ok: false, error: 'unauthorized' }))
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  var rawPayload = (p.payload || '').toString();
  if (!rawPayload && p.payloadB64) {
    rawPayload = stickerB64ToUtf8_((p.payloadB64 || '').toString());
  }
  if (!rawPayload) {
    return HtmlService.createHtmlOutput(buildStickerSaveMessageHtml_({ ok: false, error: 'missing payload' }))
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  var result = saveStickersFromPayloadRaw_(rawPayload);
  return HtmlService.createHtmlOutput(buildStickerSaveMessageHtml_(result))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getKpiConfigPayload_(yearStr) {
  var year = (yearStr || '').toString().trim();
  var sh = getConfigSheet_();
  var data = sh.getDataRange().getValues();
  var invalidByGroup = {};
  var authorByRow = {};

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var y = (row[0] || '').toString().trim();
    if (year && y !== year) continue;

    var rowType = (row[1] || '').toString().trim().toLowerCase();
    var groupKey = (row[2] || '').toString();
    var authorRowKey = (row[3] || '').toString();
    var invalid = row[4] === true || (row[4] || '').toString().toLowerCase() === 'true';
    var authorNoPoints = row[5] === true || (row[5] || '').toString().toLowerCase() === 'true';
    var kOverride = row[6];
    if (kOverride !== '' && kOverride !== null && kOverride !== undefined) kOverride = parseInt(kOverride, 10);

    if (rowType === 'group' && groupKey) {
      invalidByGroup[groupKey] = invalid;
    } else if (rowType === 'author' && authorRowKey) {
      var slot = authorByRow[authorRowKey] || {};
      slot.authorNoPoints = authorNoPoints;
      if (!isNaN(kOverride) && kOverride >= 1 && kOverride <= 4) slot.kOverride = kOverride;
      else slot.kOverride = null;
      var hasCons = false;
      if (row.length >= 9) {
        hasCons = row[7] === true || (row[7] || '').toString().toLowerCase() === 'true';
      }
      slot.hasConsensus = hasCons;
      authorByRow[authorRowKey] = slot;
    }
  }

  return {
    ok: true,
    year: year,
    invalidByGroup: invalidByGroup,
    authorByRow: authorByRow
  };
}

function findRowIndex_(sh, year, rowType, groupKey, authorRowKey) {
  var data = sh.getDataRange().getValues();
  var y = (year || '').toString().trim();
  var rt = (rowType || '').toString().trim().toLowerCase();
  var gk = (groupKey || '').toString();
  var ak = (authorRowKey || '').toString();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if ((row[0] || '').toString().trim() !== y) continue;
    if ((row[1] || '').toString().trim().toLowerCase() !== rt) continue;
    if (rt === 'group' && String(row[2] || '') === gk) return i + 1;
    if (rt === 'author' && String(row[3] || '') === ak) return i + 1;
  }
  return -1;
}

function setInvalidRow_(yearStr, groupKeyEnc, invalid) {
  var year = (yearStr || '').toString().trim();
  var groupKey = (groupKeyEnc || '').toString();
  if (!year || !groupKey) return { ok: false, error: 'missing year or groupKey' };

  var sh = getConfigSheet_();
  var rowIdx = findRowIndex_(sh, year, 'group', groupKey, '');
  var now = new Date();

  if (invalid) {
    if (rowIdx === -1) {
      sh.appendRow([year, 'group', groupKey, '', true, false, '', false, now]);
    } else {
      sh.getRange(rowIdx, 5).setValue(true);
      var lc = sh.getLastColumn();
      if (lc >= 9) sh.getRange(rowIdx, 9).setValue(now);
      else sh.getRange(rowIdx, 8).setValue(now);
    }
  } else {
    if (rowIdx !== -1) {
      sh.deleteRow(rowIdx);
    }
  }

  return { ok: true };
}

function setAuthorRow_(yearStr, authorRowKeyEnc, authorNoPoints, kOverrideRaw, hasConsensus) {
  var year = (yearStr || '').toString().trim();
  var authorRowKey = (authorRowKeyEnc || '').toString();
  if (!year || !authorRowKey) return { ok: false, error: 'missing year or authorRowKey' };

  var kOverride = '';
  if (kOverrideRaw !== undefined && kOverrideRaw !== null && kOverrideRaw !== '') {
    var n = parseInt(kOverrideRaw, 10);
    if (!isNaN(n) && n >= 1 && n <= 4) kOverride = n;
  }

  var hc = !!hasConsensus;

  var sh = getConfigSheet_();
  var rowIdx = findRowIndex_(sh, year, 'author', '', authorRowKey);
  var now = new Date();

  var emptyRow = !authorNoPoints && kOverride === '' && !hc;

  if (emptyRow) {
    if (rowIdx !== -1) sh.deleteRow(rowIdx);
    return { ok: true };
  }

  if (rowIdx === -1) {
    sh.appendRow([year, 'author', '', authorRowKey, false, authorNoPoints, kOverride, hc, now]);
  } else {
    var ncol = sh.getRange(rowIdx, 1, rowIdx, sh.getLastColumn()).getValues()[0].length;
    sh.getRange(rowIdx, 6).setValue(authorNoPoints);
    sh.getRange(rowIdx, 7).setValue(kOverride === '' ? '' : kOverride);
    if (ncol >= 9) {
      sh.getRange(rowIdx, 8).setValue(hc);
      sh.getRange(rowIdx, 9).setValue(now);
    } else {
      sh.getRange(rowIdx, 8).setValue(now);
    }
  }

  return { ok: true };
}

// --- Web App: tra cứu sheet năm + upload (code gốc của bạn) ---

function doGet(e) {
  e = e || {};
  if (!e.parameter) e.parameter = {};

  var kpi = handleKpiConfigDoGet_(e);
  if (kpi) return kpi;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = e.parameter.sheet || '';

  var sheets = ss.getSheets();
  var availableYears = [];

  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (/^\d{4}$/.test(name)) {
      availableYears.push(name);
    }
  }

  availableYears.sort(function(a, b) { return b - a; });

  if (!sheetName) {
    var obj0 = {
      availableYears: availableYears,
      values: []
    };
    return jsonOut_(obj0, (e && e.parameter && e.parameter.callback) ? e.parameter.callback : '');
  }

  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    var obj1 = {
      error: 'Sheet not found: ' + sheetName,
      availableYears: availableYears,
      values: []
    };
    return jsonOut_(obj1, (e && e.parameter && e.parameter.callback) ? e.parameter.callback : '');
  }

  var data = sheet.getDataRange().getValues();

  var obj2 = {
    values: data,
    availableYears: availableYears
  };
  return jsonOut_(obj2, (e && e.parameter && e.parameter.callback) ? e.parameter.callback : '');
}

function normalizeText_(value) {
  return String(value == null ? '' : value).toLowerCase().replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
}

function normalizeAuthor_(value) {
  var s = String(value == null ? '' : value).toLowerCase();
  s = s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
  s = s.replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
  return s;
}

function findHeaderIndex_(header, candidates, fallback) {
  if (!header || header.length === 0) return fallback;
  var norm = [];
  for (var i = 0; i < header.length; i++) {
    norm.push(normalizeText_(header[i]).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' '));
  }
  for (var c = 0; c < candidates.length; c++) {
    var idx = norm.indexOf(candidates[c]);
    if (idx >= 0) return idx;
  }
  return fallback;
}

function dedupValues_(values) {
  if (!values || values.length <= 2) return { values: values || [], removed: 0 };
  var header = values[0];
  var iActivityType = findHeaderIndex_(header, ['loai hoat dong'], 2);
  var iRanking = findHeaderIndex_(header, ['xep hang', 'quartile', 'ranking'], 3);
  var iTitle = findHeaderIndex_(header, ['ten cong trinh', 'ten bai bao', 'title'], 4);
  var iJournal = findHeaderIndex_(header, ['ten tap chi', 'tap chi'], 5);
  var iAuthor = findHeaderIndex_(header, ['tac gia', 'authors'], 6);
  var iA = findHeaderIndex_(header, ['tong tac gia', 'so tac gia'], 8);
  var iH = findHeaderIndex_(header, ['h max', 'hmax', 'h_max', 'gio toi da'], 9);
  var iStt = findHeaderIndex_(header, ['stt'], 1);

  var out = [header];
  var seen = {};
  var removed = 0;
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!row) continue;
    var key = [
      normalizeText_(row[iActivityType]),
      normalizeText_(row[iRanking]),
      normalizeText_(row[iTitle]),
      normalizeText_(row[iJournal]),
      parseInt(row[iA], 10) || 0,
      parseInt(row[iH], 10) || 0,
      normalizeAuthor_(row[iAuthor])
    ].join('||');
    if (seen[key]) { removed++; continue; }
    seen[key] = true;
    if (iStt >= 0) row[iStt] = out.length;
    out.push(row);
  }
  return { values: out, removed: removed };
}

// --- Admin Auth (CSDL: sheet Admin_Auth, lưu mật khẩu băm SHA-256 + OTP khôi phục qua email) ---

function getAdminAuthSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ADMIN_AUTH_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(ADMIN_AUTH_SHEET_NAME);
    sh.appendRow(['key', 'value', 'updatedAt']);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  return sh;
}

function getAdminAuthMap_() {
  var sh = getAdminAuthSheet_();
  var data = sh.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var k = (data[i][0] || '').toString().trim();
    if (!k) continue;
    map[k] = data[i][1] === undefined || data[i][1] === null ? '' : data[i][1].toString();
  }
  return map;
}

function setAdminAuthValue_(key, value) {
  var sh = getAdminAuthSheet_();
  var data = sh.getDataRange().getValues();
  var now = new Date();
  var val = value === undefined || value === null ? '' : String(value);
  for (var i = 1; i < data.length; i++) {
    if ((data[i][0] || '').toString().trim() === key) {
      sh.getRange(i + 1, 2).setValue(val);
      sh.getRange(i + 1, 3).setValue(now);
      return;
    }
  }
  sh.appendRow([key, val, now]);
}

function sha256Hex_(text) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var b = digest[i];
    if (b < 0) b += 256;
    var h = b.toString(16);
    if (h.length === 1) h = '0' + h;
    hex += h;
  }
  return hex;
}

function constantTimeEquals_(a, b) {
  var sa = String(a || '');
  var sb = String(b || '');
  if (sa.length !== sb.length) return false;
  var diff = 0;
  for (var i = 0; i < sa.length; i++) {
    diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  }
  return diff === 0;
}

function isValidEmail_(email) {
  var s = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function maskEmail_(email) {
  var s = String(email || '').trim();
  var parts = s.split('@');
  if (parts.length !== 2) return '';
  var local = parts[0];
  var domain = parts[1];
  if (local.length <= 2) return local.charAt(0) + '***@' + domain;
  return local.slice(0, 2) + '***' + local.slice(-1) + '@' + domain;
}

function getAdminAuthStatus_() {
  var map = getAdminAuthMap_();
  var initialized = !!(map.password_hash && map.password_salt);
  var email = (map.recovery_email || '').trim();
  return {
    ok: true,
    initialized: initialized,
    hasRecoveryEmail: !!email,
    maskedEmail: email ? maskEmail_(email) : ''
  };
}

function setupAdminPassword_(password, recoveryEmail) {
  var map = getAdminAuthMap_();
  if (map.password_hash && map.password_salt) {
    return { ok: false, error: 'already_initialized' };
  }
  var pw = String(password || '');
  if (pw.length < 6) {
    return { ok: false, error: 'password_too_short' };
  }
  var email = String(recoveryEmail || '').trim().toLowerCase();
  if (!isValidEmail_(email)) {
    return { ok: false, error: 'invalid_email' };
  }
  var salt = Utilities.getUuid();
  var hash = sha256Hex_(salt + ':' + pw);
  setAdminAuthValue_('password_salt', salt);
  setAdminAuthValue_('password_hash', hash);
  setAdminAuthValue_('recovery_email', email);
  return { ok: true, maskedEmail: maskEmail_(email) };
}

function verifyAdminPassword_(password) {
  var map = getAdminAuthMap_();
  if (!map.password_hash || !map.password_salt) {
    return { ok: false, error: 'not_initialized' };
  }
  var pw = String(password || '');
  if (!pw) {
    return { ok: false, error: 'invalid_password' };
  }
  var candidateHash = sha256Hex_(map.password_salt + ':' + pw);
  if (!constantTimeEquals_(candidateHash, map.password_hash)) {
    return { ok: false, error: 'invalid_password' };
  }
  return { ok: true };
}

function changeAdminPassword_(currentPassword, newPassword, recoveryEmail) {
  var verified = verifyAdminPassword_(currentPassword);
  if (!verified.ok) return verified;

  var npw = String(newPassword || '');
  var email = String(recoveryEmail || '').trim().toLowerCase();
  if (!npw && !email) {
    return { ok: false, error: 'nothing_to_update' };
  }
  if (npw) {
    if (npw.length < 6) return { ok: false, error: 'password_too_short' };
    var salt = Utilities.getUuid();
    var hash = sha256Hex_(salt + ':' + npw);
    setAdminAuthValue_('password_salt', salt);
    setAdminAuthValue_('password_hash', hash);
  }
  if (email) {
    if (!isValidEmail_(email)) return { ok: false, error: 'invalid_email' };
    setAdminAuthValue_('recovery_email', email);
  }
  var updated = getAdminAuthMap_();
  return {
    ok: true,
    maskedEmail: updated.recovery_email ? maskEmail_(updated.recovery_email) : ''
  };
}

function requestPasswordReset_(emailInput) {
  var map = getAdminAuthMap_();
  if (!map.password_hash || !map.password_salt) {
    return { ok: false, error: 'not_initialized' };
  }
  var savedEmail = (map.recovery_email || '').trim().toLowerCase();
  if (!savedEmail) {
    return { ok: false, error: 'no_recovery_email' };
  }
  var provided = String(emailInput || '').trim().toLowerCase();
  if (!provided || provided !== savedEmail) {
    return { ok: false, error: 'email_mismatch' };
  }

  var otp = String(Math.floor(100000 + Math.random() * 900000));
  var otpSalt = Utilities.getUuid();
  var otpHash = sha256Hex_(otpSalt + ':' + otp);
  var expiresAt = new Date(new Date().getTime() + 10 * 60 * 1000).toISOString();

  setAdminAuthValue_('reset_otp_salt', otpSalt);
  setAdminAuthValue_('reset_otp_hash', otpHash);
  setAdminAuthValue_('reset_otp_expires', expiresAt);
  setAdminAuthValue_('reset_otp_attempts', '0');

  try {
    MailApp.sendEmail({
      to: savedEmail,
      subject: '[KPI KHCN] Mã xác nhận đặt lại mật khẩu Admin',
      body: 'Xin chào,\n\n'
        + 'Mã xác nhận (OTP) để đặt lại mật khẩu quản trị Hệ thống Tra cứu KPI KHCN là:\n\n'
        + '    ' + otp + '\n\n'
        + 'Mã có hiệu lực trong 10 phút.\n'
        + 'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.\n'
    });
  } catch (mailErr) {
    return { ok: false, error: 'mail_send_failed', detail: String(mailErr && mailErr.message ? mailErr.message : mailErr) };
  }

  return { ok: true, maskedEmail: maskEmail_(savedEmail), expiresInMinutes: 10 };
}

function resetAdminPassword_(otpInput, newPassword) {
  var map = getAdminAuthMap_();
  if (!map.reset_otp_hash || !map.reset_otp_salt || !map.reset_otp_expires) {
    return { ok: false, error: 'no_active_otp' };
  }
  var attempts = parseInt(map.reset_otp_attempts || '0', 10) || 0;
  if (attempts >= 5) {
    setAdminAuthValue_('reset_otp_hash', '');
    setAdminAuthValue_('reset_otp_salt', '');
    setAdminAuthValue_('reset_otp_expires', '');
    return { ok: false, error: 'otp_too_many_attempts' };
  }
  var expMs = Date.parse(map.reset_otp_expires);
  if (isNaN(expMs) || new Date().getTime() > expMs) {
    setAdminAuthValue_('reset_otp_hash', '');
    setAdminAuthValue_('reset_otp_salt', '');
    setAdminAuthValue_('reset_otp_expires', '');
    return { ok: false, error: 'otp_expired' };
  }

  var otp = String(otpInput || '').trim();
  var candidateHash = sha256Hex_(map.reset_otp_salt + ':' + otp);
  if (!constantTimeEquals_(candidateHash, map.reset_otp_hash)) {
    setAdminAuthValue_('reset_otp_attempts', String(attempts + 1));
    return { ok: false, error: 'invalid_otp', remainingAttempts: Math.max(0, 4 - attempts) };
  }

  var npw = String(newPassword || '');
  if (npw.length < 6) {
    return { ok: false, error: 'password_too_short' };
  }

  var salt = Utilities.getUuid();
  var hash = sha256Hex_(salt + ':' + npw);
  setAdminAuthValue_('password_salt', salt);
  setAdminAuthValue_('password_hash', hash);
  setAdminAuthValue_('reset_otp_hash', '');
  setAdminAuthValue_('reset_otp_salt', '');
  setAdminAuthValue_('reset_otp_expires', '');
  setAdminAuthValue_('reset_otp_attempts', '0');

  return { ok: true };
}

function doPost(e) {
  e = e || {};
  var stickerMsg = trySaveStickersViaFormPost_(e);
  if (stickerMsg) return stickerMsg;

  if (!e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'no_post_data'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'setupAdminPassword') {
      return jsonOut_(setupAdminPassword_(data.password, data.recoveryEmail));
    }
    if (data.action === 'verifyAdminPassword') {
      return jsonOut_(verifyAdminPassword_(data.password));
    }
    if (data.action === 'changeAdminPassword') {
      return jsonOut_(changeAdminPassword_(data.currentPassword, data.newPassword, data.recoveryEmail));
    }
    if (data.action === 'requestPasswordReset') {
      return jsonOut_(requestPasswordReset_(data.email));
    }
    if (data.action === 'resetAdminPassword') {
      return jsonOut_(resetAdminPassword_(data.otp, data.newPassword));
    }

    if (data.action === 'write' && data.values && data.sheetName) {
      var sheetName = data.sheetName;
      var sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }

      var dedupResult = dedupValues_(data.values);
      var values = dedupResult.values;

      sheet.clear();
      sheet.getRange(1, 1, values.length, values[0].length).setValues(values);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        rows: values.length,
        rowsRemovedAsDuplicates: dedupResult.removed,
        sheetName: sheetName
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
