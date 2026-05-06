/**
 * KPI_Config — sheet KPI_Config + API ?action=getKpiConfig|setInvalid|setAuthorRow
 * Đặt SECRET_TOKEN khớp với KPI_CONFIG_TOKEN trong user.html (hoặc để '').
 */
var KPI_CONFIG_SHEET_NAME = 'KPI_Config';
var SECRET_TOKEN = '';

function handleKpiConfigDoGet_(e) {
  var p = e.parameter;
  var action = p.action || '';
  if (!action) return null;

  if (SECRET_TOKEN && (p.token || '') !== SECRET_TOKEN) {
    return jsonOut_({ ok: false, error: 'unauthorized' });
  }

  try {
    if (action === 'getKpiConfig') {
      return jsonOut_(getKpiConfigPayload_(p.year));
    }
    if (action === 'setInvalid') {
      return jsonOut_(setInvalidRow_(p.year, p.groupKey, p.invalid === 'true' || p.invalid === '1'));
    }
    if (action === 'setAuthorRow') {
      return jsonOut_(setAuthorRow_(
        p.year,
        p.authorRowKey,
        p.authorNoPoints === 'true' || p.authorNoPoints === '1',
        p.kOverride,
        p.hasConsensus === 'true' || p.hasConsensus === '1'
      ));
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err.message || err) });
  }

  return null;
}

function jsonOut_(obj) {
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
    return ContentService.createTextOutput(JSON.stringify({
      availableYears: availableYears,
      values: []
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Sheet not found: ' + sheetName,
      availableYears: availableYears,
      values: []
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();

  return ContentService.createTextOutput(JSON.stringify({
    values: data,
    availableYears: availableYears
  })).setMimeType(ContentService.MimeType.JSON);
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

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    var data = JSON.parse(e.postData.contents);

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
