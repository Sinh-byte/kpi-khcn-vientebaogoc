'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

const jsFiles = [
    'assets/js/config.js',
    'assets/js/kpi-core.js',
    'assets/js/admin-auth.js',
    'assets/js/admin-dashboard.js',
    'assets/js/admin-kpi.js',
    'assets/js/user-portal.js',
    'apps-script/Code.gs'
];

const htmlFiles = ['index.html', 'admin-kpi.html', 'user.html'];

let hasError = false;

for (const rel of jsFiles) {
    const full = path.join(ROOT, rel);
    const code = fs.readFileSync(full, 'utf8');
    try {
        new vm.Script(code, { filename: rel });
        console.log('SYNTAX OK:', rel);
    } catch (err) {
        console.error('SYNTAX ERROR:', rel, err.message);
        hasError = true;
    }
    if (/ADMIN_PASSWORD|admin2024/.test(code)) {
        console.error('HARDCODED SECRET DETECTED:', rel);
        hasError = true;
    }
}

for (const rel of htmlFiles) {
    const full = path.join(ROOT, rel);
    const html = fs.readFileSync(full, 'utf8');
    if (/ADMIN_PASSWORD|admin2024/.test(html)) {
        console.error('HARDCODED SECRET DETECTED:', rel);
        hasError = true;
    }
    const refs = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((m) => m[1]);
    for (const assetRel of refs) {
        const assetFull = path.join(ROOT, assetRel);
        if (!fs.existsSync(assetFull)) {
            console.error('MISSING ASSET:', rel, '->', assetRel);
            hasError = true;
        }
    }
    console.log('HTML OK:', rel, `(${refs.length} local assets verified)`);
}

if (hasError) process.exit(1);
console.log('ALL CHECKS PASSED.');
