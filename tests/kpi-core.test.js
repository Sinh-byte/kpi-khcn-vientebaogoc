'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const KpiCore = require('../assets/js/kpi-core.js');

test('normalizeHeaderText strips Vietnamese accents and punctuation', () => {
    assert.equal(KpiCore.normalizeHeaderText('Giờ tối đa (H_max)'), 'gio toi da h max');
    assert.equal(KpiCore.normalizeHeaderText('Đánh giá / Xếp hạng'), 'danh gia xep hang');
    assert.equal(KpiCore.normalizeHeaderText('  Năm  '), 'nam');
});

test('normalizeAuthorName normalizes Vietnamese names for matching', () => {
    assert.equal(KpiCore.normalizeAuthorName('Phạm Văn Phúc'), 'phamvanphuc');
    assert.equal(KpiCore.normalizeAuthorName('P. V. Pham'), 'pvpham');
    assert.equal(KpiCore.normalizeAuthorName('Đào Thị Hồng'), 'daothihong');
});

test('parseFlag handles common truthy and falsy values', () => {
    assert.equal(KpiCore.parseFlag('1'), true);
    assert.equal(KpiCore.parseFlag('Có'), true);
    assert.equal(KpiCore.parseFlag('true'), true);
    assert.equal(KpiCore.parseFlag('x'), true);
    assert.equal(KpiCore.parseFlag('0'), false);
    assert.equal(KpiCore.parseFlag(''), false);
});

test('calculateScore computes sole author, primary author, and coauthor scores', () => {
    // Sole author gets full H_max
    assert.equal(KpiCore.calculateScore('first', 1, 1, 3600), 3600);

    // 4 authors, K=1, H=3600:
    // part1 = 3600 * 1/3 = 1200; part2 = 3600 * 2/3 * 1/4 = 600
    assert.equal(KpiCore.calculateScore('first', 4, 1, 3600), 1800);
    assert.equal(KpiCore.calculateScore('last', 4, 1, 3600), 1800);
    assert.equal(KpiCore.calculateScore('coauthor', 4, 1, 3600), 600);

    // 2 primary authors (K=2), 4 total authors, H=3000:
    // part1 = 3000 * 1/3 * 1/2 = 500; part2 = 3000 * 2/3 * 1/4 = 500
    assert.equal(KpiCore.calculateScore('first', 4, 2, 3000), 1000);
    assert.equal(KpiCore.calculateScore('coauthor', 4, 2, 3000), 500);
});

test('dedupSheetRows removes duplicate author-activity records and renumbers STT', () => {
    const header = ['Năm', 'STT', 'Loại hoạt động', 'Xếp hạng', 'Tên công trình', 'Tên tạp chí', 'Tác giả', 'Role', 'Tổng tác giả', 'H_max', 'Điểm'];
    const row1 = ['2026', 1, 'Bài báo tạp chí', 'Q1', 'Paper A', 'Journal X', 'Phạm Văn Phúc', 'first', 3, 3600, 2000];
    const row1Dup = ['2026', 2, 'Bài báo tạp chí', 'Q1', 'paper a', 'journal x', 'Pham Van Phuc', 'first', 3, 3600, 2000];
    const row2 = ['2026', 3, 'Bài báo tạp chí', 'Q2', 'Paper B', 'Journal Y', 'Nguyễn A', 'coauthor', 4, 3000, 500];

    const result = KpiCore.dedupSheetRows([header, row1, row1Dup, row2]);
    assert.equal(result.removed, 1);
    assert.equal(result.rows.length, 3);
    assert.equal(result.rows[1][1], 1);
    assert.equal(result.rows[2][1], 2);
});

test('parseUniqueAuthorsFromSheetRows returns deduplicated sorted author list', () => {
    const rows = [
        ['Năm', 'STT', 'Loại hoạt động', 'Xếp hạng', 'Tên công trình', 'Tên tạp chí', 'Tác giả'],
        ['2026', 1, 'Bài báo', 'Q1', 'A', 'J1', 'Phạm Văn Phúc'],
        ['2026', 2, 'Bài báo', 'Q2', 'B', 'J2', 'Pham Van Phuc'],
        ['2026', 3, 'Bài báo', 'Q1', 'C', 'J3', 'An Nguyễn']
    ];
    const authors = KpiCore.parseUniqueAuthorsFromSheetRows(rows);
    assert.equal(authors.length, 2);
    assert.equal(authors[0], 'An Nguyễn');
    assert.equal(authors[1], 'Phạm Văn Phúc');
});
