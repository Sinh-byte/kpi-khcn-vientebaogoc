/**
 * KPI_Config — đồng bộ cờ quản trị & K lên Google Sheet.
 *
 * Cách dùng:
 * 1. Tạo sheet tên chính xác: KPI_Config
 * 2. Hàng 1 (tiêu đề): year | rowType | groupKey | authorRowKey | invalid | authorNoPoints | kOverride | updatedAt
 * 3. Dán toàn bộ file này vào dự án Apps Script của bạn.
 * 4. Trong doGet(e) hiện có, gọi: var r = handleKpiConfigDoGet_(e); if (r) return r;
 * 5. Đặt SECRET_TOKEN giống giá trị KPI_CONFIG_TOKEN trong user.html (hoặc để rỗng = không kiểm tra).
 */

var KPI_CONFIG_SHEET_NAME = 'KPI_Config';
var SECRET_TOKEN = ''; // ví dụ 'your-secret'; đồng bộ với user.html KPI_CONFIG_TOKEN

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

/**
 * rowType = 'group' | 'author'
 * group: invalid áp theo groupKey (cột authorRowKey để trống)
 * author: authorRowKey + authorNoPoints / kOverride (invalid không dùng)
 */
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
