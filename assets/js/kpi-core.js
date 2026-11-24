(function (global) {
    'use strict';

    function normalizeHeaderText(text) {
        return (text || '').toString().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function firstExistingColumn(headerMap, keys, fallbackIndex) {
        for (var i = 0; i < keys.length; i++) {
            if (headerMap[keys[i]] !== undefined) return headerMap[keys[i]];
        }
        return fallbackIndex;
    }

    function parseFlag(value) {
        var raw = (value || '').toString().trim().toLowerCase();
        return raw === '1' || raw === 'x' || raw === 'yes' || raw === 'y' || raw === 'true' || raw === 'co' || raw === 'có';
    }

    function normalizeText(value) {
        return (value || '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
    }

    function normalizeAuthorName(name) {
        if (!name) return '';
        return name.toString().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }

    function calculateScore(role, totalAuthors, primaryCount, hMax) {
        var A = Number(totalAuthors) || 1;
        var K = Number(primaryCount) || 1;
        var H = Number(hMax) || 0;
        if (A === 1) return Math.round(H);
        var part1 = (H * (1 / 3)) * (1 / K);
        var part2 = (H * (2 / 3)) * (1 / A);
        if (role === 'first' || role === 'corresponding' || role === 'last') {
            return Math.round(part1 + part2);
        }
        return Math.round(part2);
    }

    function dedupSheetRows(rows) {
        if (!rows || rows.length <= 1) return { rows: rows || [], removed: 0 };
        var header = rows[0];
        var out = [header];
        var seen = {};
        var removed = 0;
        for (var i = 1; i < rows.length; i++) {
            var r = rows[i];
            if (!r) continue;
            var key = [
                normalizeText(r[2]),
                normalizeText(r[3]),
                normalizeText(r[4]),
                normalizeText(r[5]),
                parseInt(r[8], 10) || 0,
                parseInt(r[9], 10) || 0,
                normalizeAuthorName(r[6])
            ].join('||');
            if (seen[key]) {
                removed++;
                continue;
            }
            seen[key] = true;
            var rowCopy = r.slice();
            rowCopy[1] = out.length;
            out.push(rowCopy);
        }
        return { rows: out, removed: removed };
    }

    function parseUniqueAuthorsFromSheetRows(rows) {
        if (!rows || rows.length < 2) return [];
        var headers = rows[0] || [];
        var headerMap = {};
        for (var h = 0; h < headers.length; h++) {
            var hk = normalizeHeaderText(headers[h]);
            if (hk && headerMap[hk] === undefined) headerMap[hk] = h;
        }
        var colAuthor = firstExistingColumn(headerMap, ['tac gia', 'danh sach tac gia', 'authors'], 6);
        var byNorm = {};
        for (var i = 1; i < rows.length; i++) {
            var row = rows[i];
            if (!row || row.length <= colAuthor) continue;
            var raw = (row[colAuthor] || '').toString().trim();
            if (!raw) continue;
            var nk = normalizeAuthorName(raw);
            if (!nk) continue;
            if (!byNorm[nk]) byNorm[nk] = raw;
        }
        return Object.keys(byNorm)
            .map(function (k) { return byNorm[k]; })
            .sort(function (a, b) { return a.localeCompare(b, 'vi', { sensitivity: 'base' }); });
    }

    var KpiCore = {
        normalizeHeaderText: normalizeHeaderText,
        firstExistingColumn: firstExistingColumn,
        parseFlag: parseFlag,
        normalizeText: normalizeText,
        normalizeAuthorName: normalizeAuthorName,
        calculateScore: calculateScore,
        dedupSheetRows: dedupSheetRows,
        parseUniqueAuthorsFromSheetRows: parseUniqueAuthorsFromSheetRows
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = KpiCore;
    } else {
        global.KpiCore = KpiCore;
    }
})(typeof window !== 'undefined' ? window : globalThis);
