(function (global) {
    'use strict';

    var AppConfig = {
        SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwXxaOjFOX17X9IttC7nFn22Yhd3hDgOUzONGnQo3GOkz0UoyeNLb7ToDsKTQtCFSMwEA/exec',
        KPI_CONFIG_TOKEN: '',
        DEFAULT_MANDATORY_RESEARCH_KPI_HOURS: 1760,
        ORG_NAME: 'Viện Tế bào gốc - Trường ĐHKHTN, ĐHQG TP.HCM'
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AppConfig;
    } else {
        global.AppConfig = AppConfig;
    }
})(typeof window !== 'undefined' ? window : globalThis);
