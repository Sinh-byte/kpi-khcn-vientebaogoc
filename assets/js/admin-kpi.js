(function () {
    'use strict';

    var SCRIPT_URL = window.AppConfig.SCRIPT_URL;
    var parseUniqueAuthorsFromSheetRows = window.KpiCore.parseUniqueAuthorsFromSheetRows;

    function loadYears() {
        return fetch(SCRIPT_URL)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var years = data.availableYears || [];
                var sel = document.getElementById('yearSelect');
                sel.innerHTML = '';
                if (!years.length) {
                    sel.innerHTML = '<option value="">Chưa có năm</option>';
                    return;
                }
                years.forEach(function (y) {
                    var o = document.createElement('option');
                    o.value = y;
                    o.textContent = 'Năm ' + y;
                    sel.appendChild(o);
                });
            })
            .catch(function () {
                document.getElementById('yearSelect').innerHTML = '<option value="">Lỗi tải năm</option>';
            });
    }

    function openPersonInFrame(year, displayName) {
        var frame = document.getElementById('kpiFrame');
        var ph = document.getElementById('detailPlaceholder');
        var url = 'user.html?year=' + encodeURIComponent(year)
            + '&name=' + encodeURIComponent(displayName)
            + '&fromAdmin=1&embed=1';
        frame.src = url;
        frame.classList.remove('hidden');
        ph.classList.add('hidden');

        var buttons = document.querySelectorAll('#peopleList button');
        for (var i = 0; i < buttons.length; i++) {
            var b = buttons[i];
            b.classList.toggle('is-active', b.getAttribute('data-name') === displayName);
        }
    }

    function loadPeopleForYear(year) {
        var st = document.getElementById('listStats');
        var listEl = document.getElementById('peopleList');
        var empty = document.getElementById('emptyHint');
        var frame = document.getElementById('kpiFrame');
        var ph = document.getElementById('detailPlaceholder');

        if (!year) {
            listEl.innerHTML = '';
            empty.classList.remove('hidden');
            if (st) st.textContent = '';
            frame.classList.add('hidden');
            ph.classList.remove('hidden');
            frame.src = 'about:blank';
            return Promise.resolve([]);
        }

        if (st) st.textContent = 'Đang tải…';
        listEl.innerHTML = '';
        frame.classList.add('hidden');
        ph.classList.remove('hidden');
        frame.src = 'about:blank';

        return fetch(SCRIPT_URL + '?sheet=' + encodeURIComponent(year))
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var rows = data.values || [];
                var names = parseUniqueAuthorsFromSheetRows(rows);
                listEl.innerHTML = '';
                if (!names.length) {
                    empty.classList.remove('hidden');
                    if (st) st.textContent = 'Không có tên trên sheet năm ' + year + '.';
                    return names;
                }
                empty.classList.add('hidden');
                if (st) st.textContent = year + ': ' + names.length + ' người.';
                names.forEach(function (displayName) {
                    var li = document.createElement('li');
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.textContent = displayName;
                    btn.setAttribute('data-name', displayName);
                    btn.addEventListener('click', function () {
                        openPersonInFrame(year, displayName);
                    });
                    li.appendChild(btn);
                    listEl.appendChild(li);
                });
                return names;
            })
            .catch(function (err) {
                listEl.innerHTML = '';
                empty.classList.remove('hidden');
                if (st) st.textContent = 'Lỗi: ' + (err && err.message ? err.message : err);
                return [];
            });
    }

    function showMain() {
        document.getElementById('loginView').classList.add('hidden');
        document.getElementById('mainView').classList.remove('hidden');
    }

    function showLogin() {
        document.getElementById('mainView').classList.add('hidden');
        document.getElementById('loginView').classList.remove('hidden');
    }

    var authCtrl = window.AdminAuth.bindAuthController({
        defaultSubtitle: 'Tra cứu KPI theo người — cùng mật khẩu với trang quản trị.',
        onAuthenticated: function () {
            showMain();
            loadYears();
        }
    });

    function checkGate() {
        if (window.AdminAuth.isAuthenticated()) {
            showMain();
            loadYears();
        } else {
            showLogin();
            authCtrl.refreshStatus();
        }
    }

    document.getElementById('backFromLoginBtn').addEventListener('click', function () {
        window.location.href = 'index.html';
    });
    document.getElementById('loadPeopleBtn').addEventListener('click', function () {
        loadPeopleForYear(document.getElementById('yearSelect').value);
    });
    document.getElementById('toDashboardBtn').addEventListener('click', function () {
        window.location.href = 'index.html';
    });
    document.getElementById('toUserBtn').addEventListener('click', function () {
        window.location.href = 'user.html';
    });
    document.getElementById('logoutBtn').addEventListener('click', function () {
        window.AdminAuth.setAuthenticated(false);
        window.location.href = 'index.html';
    });

    checkGate();
})();
