var SCRIPT_URL = window.AppConfig.SCRIPT_URL;
var KPI_CONFIG_TOKEN = window.AppConfig.KPI_CONFIG_TOKEN;
var currentFileData = null;
var announcementsDraft = [];
var stickersDraft = [];
var authCtrl = window.AdminAuth.bindAuthController({
    defaultSubtitle: 'Nhập mật khẩu để tiếp tục',
    onAuthenticated: function() {
        showDashboard();
    },
    onStatusLoaded: function(meta) {
        var emailInfo = document.getElementById('currentRecoveryEmailInfo');
        if (emailInfo) {
            emailInfo.textContent = meta.maskedEmail
                ? ('Email khôi phục hiện tại: ' + meta.maskedEmail)
                : 'Chưa cấu hình email khôi phục.';
        }
    }
});

function checkAuth() {
    if (window.AdminAuth.isAuthenticated()) {
        showDashboard();
    }
    authCtrl.refreshStatus();
}

function saveAdminSecuritySettings() {
    if (!window.AdminAuth.isAuthenticated()) return;
    var cur = document.getElementById('changeCurrentPwInput').value;
    var npw = document.getElementById('changeNewPwInput').value;
    var npw2 = document.getElementById('changeConfirmPwInput').value;
    var email = document.getElementById('changeRecoveryEmailInput').value.trim();
    var st = document.getElementById('adminSecurityStatus');
    if (!cur) {
        st.style.color = '#c53030';
        st.textContent = 'Vui lòng nhập mật khẩu hiện tại.';
        return;
    }
    if (npw && npw.length < 6) {
        st.style.color = '#c53030';
        st.textContent = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
        return;
    }
    if (npw && npw !== npw2) {
        st.style.color = '#c53030';
        st.textContent = 'Mật khẩu mới nhập lại không khớp.';
        return;
    }
    if (!npw && !email) {
        st.style.color = '#c53030';
        st.textContent = 'Nhập mật khẩu mới hoặc email khôi phục mới để cập nhật.';
        return;
    }
    var btn = document.getElementById('saveAdminSecurityBtn');
    btn.disabled = true;
    st.style.color = '#4a5568';
    st.textContent = 'Đang cập nhật...';
    window.AdminAuth.post({
        action: 'changeAdminPassword',
        currentPassword: cur,
        newPassword: npw,
        recoveryEmail: email
    })
        .then(function(res) {
            if (res && res.ok) {
                document.getElementById('changeCurrentPwInput').value = '';
                document.getElementById('changeNewPwInput').value = '';
                document.getElementById('changeConfirmPwInput').value = '';
                document.getElementById('changeRecoveryEmailInput').value = '';
                st.style.color = '#2f855a';
                st.textContent = 'Đã cập nhật thông tin bảo mật vào CSDL thành công.';
                authCtrl.refreshStatus();
            } else {
                st.style.color = '#c53030';
                st.textContent = window.AdminAuth.mapError(res && res.error, res);
            }
        })
        .catch(function(err) {
            st.style.color = '#c53030';
            st.textContent = 'Lỗi kết nối: ' + (err && err.message ? err.message : err);
        })
        .finally(function() {
            btn.disabled = false;
        });
}

function logout() {
    window.AdminAuth.setAuthenticated(false);
    document.getElementById('loginView').classList.remove('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
    authCtrl.showPanel('login');
}

function showDashboard() {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');
    updateStatus();
    loadUserAllocationToggle();
    loadMandatoryKpiHoursAdmin();
    loadAnnouncementsAdmin();
    loadStickersAdmin();
}

function collectAnnouncementsFromEditor() {
    var host = document.getElementById('announcementsEditorHost');
    if (!host) return [];
    var cards = host.querySelectorAll('.ann-card');
    var out = [];
    cards.forEach(function(card) {
        var id = (card.getAttribute('data-id') || '').toString().trim();
        if (!id) id = 'ann_' + Date.now();
        var createdAt = (card.getAttribute('data-created') || '').toString().trim();
        if (!createdAt) createdAt = new Date().toISOString();
        var enabledEl = card.querySelector('.ann-enabled');
        var titleEl = card.querySelector('.ann-title');
        var bodyEl = card.querySelector('.ann-body');
        var enabled = enabledEl ? !!enabledEl.checked : true;
        var title = titleEl ? (titleEl.value || '').trim() : '';
        var body = bodyEl ? (bodyEl.value || '').trim() : '';
        out.push({ id: id, title: title, body: body, enabled: enabled, createdAt: createdAt });
    });
    return out;
}

function renderAnnouncementsEditor() {
    var host = document.getElementById('announcementsEditorHost');
    if (!host) return;
    host.innerHTML = '';
    if (!announcementsDraft.length) {
        host.innerHTML = '<p style="color:#718096;font-size:0.92em;">Chưa có thông báo. Nhấn “Thêm thông báo”.</p>';
        return;
    }
    announcementsDraft.forEach(function(a) {
        var card = document.createElement('div');
        card.className = 'ann-card';
        card.setAttribute('data-id', a.id || '');
        card.setAttribute('data-created', a.createdAt || '');
        card.style.cssText = 'border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:12px;background:#fff;';

        var row1 = document.createElement('div');
        row1.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;';

        var lab = document.createElement('label');
        lab.style.cssText = 'display:flex;gap:8px;align-items:center;font-weight:600;color:#2d3748;';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'ann-enabled';
        cb.checked = !!(a.enabled === true || a.enabled === 'true' || a.enabled === 1 || a.enabled === '1');
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(' Hiển thị trên Tra cứu'));

        var del = document.createElement('button');
        del.type = 'button';
        del.textContent = 'Xóa';
        del.className = 'btn-danger';
        del.style.padding = '6px 12px';
        var deleteId = (a.id || '').toString();
        del.onclick = function() {
            announcementsDraft = announcementsDraft.filter(function(x) { return String(x.id) !== deleteId; });
            renderAnnouncementsEditor();
        };

        row1.appendChild(lab);
        row1.appendChild(del);

        var lt = document.createElement('div');
        lt.style.fontWeight = '600';
        lt.style.marginBottom = '4px';
        lt.textContent = 'Tiêu đề';
        var ti = document.createElement('input');
        ti.type = 'text';
        ti.className = 'ann-title';
        ti.value = (a.title || '');
        ti.placeholder = 'Ví dụ: Lịch nộp minh chứng KPI';
        ti.style.cssText = 'width:100%;padding:10px;margin-bottom:10px;border:2px solid #cbd5e0;border-radius:10px;';

        var lb = document.createElement('div');
        lb.style.fontWeight = '600';
        lb.style.marginBottom = '4px';
        lb.textContent = 'Nội dung';
        var ta = document.createElement('textarea');
        ta.className = 'ann-body';
        ta.rows = 4;
        ta.value = (a.body || '');
        ta.placeholder = 'Nội dung chi tiết (xuống dòng được)';
        ta.style.cssText = 'width:100%;padding:10px;border:2px solid #cbd5e0;border-radius:10px;font-family:inherit;';

        card.appendChild(row1);
        card.appendChild(lt);
        card.appendChild(ti);
        card.appendChild(lb);
        card.appendChild(ta);
        host.appendChild(card);
    });
}

function loadAnnouncementsAdmin() {
    var st = document.getElementById('announcementsAdminStatus');
    if (st) st.textContent = 'Đang tải thông báo...';
    var url = SCRIPT_URL + '?action=getAnnouncements';
    if (KPI_CONFIG_TOKEN) url += '&token=' + encodeURIComponent(KPI_CONFIG_TOKEN);
    jsonpRequest(url)
        .then(function(data) {
            announcementsDraft = (data && data.ok && Array.isArray(data.announcements)) ? data.announcements.slice() : [];
            renderAnnouncementsEditor();
            if (st) st.textContent = 'Đã tải ' + announcementsDraft.length + ' thông báo.';
        })
        .catch(function() {
            announcementsDraft = [];
            renderAnnouncementsEditor();
            if (st) st.textContent = 'Không tải được danh sách thông báo.';
        });
}

function saveAnnouncementsToServer() {
    var st = document.getElementById('announcementsAdminStatus');
    var list = collectAnnouncementsFromEditor();
    announcementsDraft = list;
    var json = JSON.stringify(list);
    if (json.length > 7500) {
        alert('Nội dung quá dài để lưu qua URL một lần. Hãy rút gọn thông báo hoặc chia nhỏ.');
        return;
    }
    if (st) st.textContent = 'Đang lưu...';
    var url = SCRIPT_URL + '?action=saveAnnouncements&payload=' + encodeURIComponent(json);
    if (KPI_CONFIG_TOKEN) url += '&token=' + encodeURIComponent(KPI_CONFIG_TOKEN);
    jsonpRequest(url)
        .then(function(res) {
            if (res && res.ok) {
                if (st) st.textContent = 'Đã lưu thông báo.';
            } else {
                if (st) st.textContent = 'Lưu thất bại.';
                alert('Không lưu được: ' + (res && res.error ? res.error : 'unknown'));
            }
        })
        .catch(function() {
            if (st) st.textContent = 'Lưu thất bại.';
            alert('Không lưu được thông báo.');
        });
}

function collectStickersFromEditor() {
    var host = document.getElementById('stickersEditorHost');
    if (!host) return [];
    var cards = host.querySelectorAll('.stk-card');
    var out = [];
    cards.forEach(function(card) {
        var id = (card.getAttribute('data-id') || '').toString().trim();
        if (!id) id = 'stk_' + Date.now();
        var createdAt = (card.getAttribute('data-created') || '').toString().trim();
        if (!createdAt) createdAt = new Date().toISOString();
        var enabledEl = card.querySelector('.stk-enabled');
        var titleEl = card.querySelector('.stk-title');
        var imgEl = card.querySelector('.stk-imageUrl');
        var linkEl = card.querySelector('.stk-linkUrl');
        var posEl = card.querySelector('.stk-position');
        var mwEl = card.querySelector('.stk-maxW');
        var zEl = card.querySelector('.stk-z');
        var ordEl = card.querySelector('.stk-order');
        var typeEl = card.querySelector('.stk-type');
        var plainEl = card.querySelector('.stk-plain');
        var maxHEl = card.querySelector('.stk-maxH');
        var enabled = enabledEl ? !!enabledEl.checked : false;
        var stickerType = (typeEl && typeEl.value === 'panel') ? 'panel' : 'image';
        var title = titleEl ? (titleEl.value || '').trim() : '';
        var imageUrl = imgEl ? (imgEl.value || '').trim() : '';
        var htmlContent = plainEl ? (plainEl.value || '') : '';
        var linkUrl = linkEl ? (linkEl.value || '').trim() : '';
        var position = posEl ? (posEl.value || 'br').trim().toLowerCase() : 'br';
        var maxWidthPx = mwEl ? parseInt(mwEl.value, 10) : (stickerType === 'panel' ? 360 : 120);
        if (isNaN(maxWidthPx)) maxWidthPx = stickerType === 'panel' ? 360 : 120;
        var maxHeightPx = maxHEl ? parseInt(maxHEl.value, 10) : 420;
        if (isNaN(maxHeightPx)) maxHeightPx = 420;
        var zIndex = zEl ? parseInt(zEl.value, 10) : 50;
        if (isNaN(zIndex)) zIndex = 50;
        var order = ordEl ? parseInt(ordEl.value, 10) : 0;
        if (isNaN(order)) order = 0;
        out.push({
            id: id,
            enabled: enabled,
            stickerType: stickerType,
            panelBodyFormat: 'plain',
            title: title,
            imageUrl: imageUrl,
            htmlContent: htmlContent,
            linkUrl: linkUrl,
            position: position,
            maxWidthPx: maxWidthPx,
            maxHeightPx: maxHeightPx,
            zIndex: zIndex,
            order: order,
            createdAt: createdAt
        });
    });
    return out;
}

function syncStickerSections(card) {
    var t = card.querySelector('.stk-type');
    var mode = t && t.value === 'panel' ? 'panel' : 'image';
    var si = card.querySelector('.stk-sec-image');
    var sp = card.querySelector('.stk-sec-panel');
    var mw = card.querySelector('.stk-maxW');
    if (si) si.style.display = mode === 'image' ? 'block' : 'none';
    if (sp) sp.style.display = mode === 'panel' ? 'block' : 'none';
    if (mw) {
        if (mode === 'panel') {
            mw.min = '200';
            mw.max = '920';
        } else {
            mw.min = '40';
            mw.max = '400';
        }
    }
}

function renderStickersEditor() {
    var host = document.getElementById('stickersEditorHost');
    if (!host) return;
    host.innerHTML = '';
    if (!stickersDraft.length) {
        host.innerHTML = '<p style="color:#718096;font-size:0.92em;line-height:1.55;">Chưa có sticker trên server. Nhấn <strong>Thêm sticker</strong> để tạo mới.</p>';
        return;
    }
    stickersDraft.forEach(function(s, idx) {
        var card = document.createElement('div');
        card.className = 'stk-card';
        card.setAttribute('data-id', s.id || '');
        card.setAttribute('data-created', s.createdAt || '');
        card.style.cssText = 'border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:12px;background:#fff;';

        var row1 = document.createElement('div');
        row1.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;';

        var lab = document.createElement('label');
        lab.style.cssText = 'display:flex;gap:8px;align-items:center;font-weight:600;color:#2d3748;';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'stk-enabled';
        cb.checked = !!(s.enabled === true || s.enabled === 'true' || s.enabled === 1 || s.enabled === '1');
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(' Hiển thị'));

        var del = document.createElement('button');
        del.type = 'button';
        del.textContent = 'Xóa';
        del.className = 'btn-danger';
        del.style.padding = '6px 12px';
        var deleteId = (s.id || '').toString();
        del.onclick = function() {
            if (!confirm('Xóa sticker này khỏi danh sách?\n\nNhấn "💾 Lưu sticker" sau đó để xóa hẳn trên server (tra cứu sẽ không còn sticker này).')) return;
            stickersDraft = stickersDraft.filter(function(x) { return String(x.id) !== deleteId; });
            renderStickersEditor();
            var stDel = document.getElementById('stickersAdminStatus');
            if (stDel) stDel.textContent = 'Đã xóa khỏi danh sách — nhấn Lưu sticker để áp dụng lên server.';
        };

        row1.appendChild(lab);
        row1.appendChild(del);
        card.appendChild(row1);

        var typeVal = ((s.stickerType || 'image') + '').trim().toLowerCase() === 'panel' ? 'panel' : 'image';
        var hintBar = document.createElement('div');
        hintBar.style.cssText = 'font-size:0.86em;color:#4a5568;margin-bottom:12px;padding:8px 10px;background:#edf2f7;border-radius:8px;line-height:1.45;border-left:3px solid #63b3ed;';
        hintBar.innerHTML = '<strong>#' + (idx + 1) + '</strong> · ' + (typeVal === 'panel' ? 'Khung văn bản' : 'Ảnh') + ' — Sửa nội dung bên dưới hoặc <strong>Xóa</strong>, rồi <strong>Lưu sticker</strong>.';
        card.appendChild(hintBar);
        var typeSel = document.createElement('select');
        typeSel.className = 'stk-type';
        typeSel.style.cssText = 'width:100%;max-width:360px;padding:10px;border:2px solid #cbd5e0;border-radius:10px;';
        [['image', 'Ảnh (URL https)'], ['panel', 'Khung nội dung (văn bản)']].forEach(function(opt) {
            var o = document.createElement('option');
            o.value = opt[0];
            o.textContent = opt[1];
            if (opt[0] === typeVal) o.selected = true;
            typeSel.appendChild(o);
        });
        var typeWrap = document.createElement('div');
        typeWrap.style.marginBottom = '12px';
        var typeLb = document.createElement('div');
        typeLb.style.fontWeight = '600';
        typeLb.style.marginBottom = '4px';
        typeLb.textContent = 'Loại sticker';
        typeWrap.appendChild(typeLb);
        typeWrap.appendChild(typeSel);
        card.appendChild(typeWrap);
        typeSel.onchange = function() { syncStickerSections(card); };

        function addLabeledInput(label, inputEl) {
            var w = document.createElement('div');
            w.style.marginBottom = '10px';
            var lb = document.createElement('div');
            lb.style.fontWeight = '600';
            lb.style.marginBottom = '4px';
            lb.textContent = label;
            w.appendChild(lb);
            w.appendChild(inputEl);
            card.appendChild(w);
        }

        var ti = document.createElement('input');
        ti.type = 'text';
        ti.className = 'stk-title';
        ti.value = (s.title || '');
        ti.placeholder = 'Ví dụ: Phụ lục 2 — Quy đổi giờ NCKH';
        ti.style.cssText = 'width:100%;padding:10px;border:2px solid #cbd5e0;border-radius:10px;';
        addLabeledInput('Tiêu đề (hiển thị trên khung; ảnh: alt)', ti);

        var secImg = document.createElement('div');
        secImg.className = 'stk-sec-image';
        var iu = document.createElement('input');
        iu.type = 'url';
        iu.className = 'stk-imageUrl';
        iu.value = (s.imageUrl || '');
        iu.placeholder = 'https://... (ảnh sticker)';
        iu.style.cssText = 'width:100%;padding:10px;border:2px solid #cbd5e0;border-radius:10px;';
        var lu = document.createElement('input');
        lu.type = 'text';
        lu.className = 'stk-linkUrl';
        lu.value = (s.linkUrl || '');
        lu.placeholder = 'Tuỳ chọn: https://... hoặc /path hoặc #anchor';
        lu.style.cssText = 'width:100%;padding:10px;border:2px solid #cbd5e0;border-radius:10px;';
        var l1 = document.createElement('div');
        l1.style.fontWeight = '600';
        l1.style.marginBottom = '4px';
        l1.textContent = 'URL ảnh (https)';
        secImg.appendChild(l1);
        secImg.appendChild(iu);
        var l2 = document.createElement('div');
        l2.style.fontWeight = '600';
        l2.style.margin = '10px 0 4px';
        l2.textContent = 'Liên kết khi bấm ảnh (tuỳ chọn)';
        secImg.appendChild(l2);
        secImg.appendChild(lu);
        card.appendChild(secImg);

        var secPanel = document.createElement('div');
        secPanel.className = 'stk-sec-panel';
        var hl = document.createElement('div');
        hl.style.fontWeight = '600';
        hl.style.marginBottom = '4px';
        hl.textContent = 'Nội dung (văn bản — gõ hoặc dán, Enter xuống dòng)';
        secPanel.appendChild(hl);
        var ta = document.createElement('textarea');
        ta.className = 'stk-plain';
        ta.rows = 14;
        ta.value = (s.htmlContent || '');
        ta.placeholder = 'Ví dụ:\nPhụ lục 2 — Quy đổi giờ...\n\n• Mục một: ...\n• Mục hai: ...';
        ta.style.cssText = 'width:100%;padding:12px;border:2px solid #cbd5e0;border-radius:10px;font-family:inherit;font-size:0.95em;line-height:1.5;';
        secPanel.appendChild(ta);
        var mhRow = document.createElement('div');
        mhRow.style.marginTop = '10px';
        var mhl = document.createElement('div');
        mhl.style.fontWeight = '600';
        mhl.style.marginBottom = '4px';
        mhl.textContent = 'Chiều cao tối đa vùng nội dung (px — có thanh cuộn)';
        mhRow.appendChild(mhl);
        var mh = document.createElement('input');
        mh.type = 'number';
        mh.className = 'stk-maxH';
        mh.min = '120';
        mh.max = '2000';
        mh.value = String(s.maxHeightPx != null ? s.maxHeightPx : 420);
        mh.style.cssText = 'width:100%;max-width:220px;padding:10px;border:2px solid #cbd5e0;border-radius:10px;';
        mhRow.appendChild(mh);
        secPanel.appendChild(mhRow);
        card.appendChild(secPanel);

        var rowGrid = document.createElement('div');
        rowGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:10px;';

        function mkSel(className, val, opts) {
            var sel = document.createElement('select');
            sel.className = className;
            sel.style.cssText = 'width:100%;padding:10px;border:2px solid #cbd5e0;border-radius:10px;';
            opts.forEach(function(o) {
                var opt = document.createElement('option');
                opt.value = o.v;
                opt.textContent = o.t;
                if (o.v === val) opt.selected = true;
                sel.appendChild(opt);
            });
            return sel;
        }

        var posVal = ((s.position || 'br') + '').trim().toLowerCase();
        var posSel = mkSel('stk-position', posVal, [
            { v: 'br', t: 'Góc phải dưới' },
            { v: 'bl', t: 'Góc trái dưới' },
            { v: 'tr', t: 'Góc phải trên' },
            { v: 'tl', t: 'Góc trái trên' }
        ]);
        var posWrap = document.createElement('div');
        var pl = document.createElement('div');
        pl.style.fontWeight = '600';
        pl.style.marginBottom = '4px';
        pl.textContent = 'Vị trí';
        posWrap.appendChild(pl);
        posWrap.appendChild(posSel);
        rowGrid.appendChild(posWrap);

        var mw = document.createElement('input');
        mw.type = 'number';
        mw.className = 'stk-maxW';
        if (typeVal === 'panel') {
            mw.min = '200';
            mw.max = '920';
            mw.value = String(s.maxWidthPx != null ? s.maxWidthPx : 360);
        } else {
            mw.min = '40';
            mw.max = '400';
            mw.value = String(s.maxWidthPx != null ? s.maxWidthPx : 120);
        }
        mw.style.cssText = 'width:100%;padding:10px;border:2px solid #cbd5e0;border-radius:10px;';
        var mwWrap = document.createElement('div');
        var ml = document.createElement('div');
        ml.style.fontWeight = '600';
        ml.style.marginBottom = '4px';
        ml.textContent = 'Rộng tối đa (px)';
        mwWrap.appendChild(ml);
        mwWrap.appendChild(mw);
        rowGrid.appendChild(mwWrap);

        var zIn = document.createElement('input');
        zIn.type = 'number';
        zIn.className = 'stk-z';
        zIn.min = '1';
        zIn.max = '9999';
        zIn.value = String(s.zIndex != null ? s.zIndex : 50);
        zIn.style.cssText = 'width:100%;padding:10px;border:2px solid #cbd5e0;border-radius:10px;';
        var zWrap = document.createElement('div');
        var zl = document.createElement('div');
        zl.style.fontWeight = '600';
        zl.style.marginBottom = '4px';
        zl.textContent = 'z-index';
        zWrap.appendChild(zl);
        zWrap.appendChild(zIn);
        rowGrid.appendChild(zWrap);

        var ord = document.createElement('input');
        ord.type = 'number';
        ord.className = 'stk-order';
        ord.value = String(s.order != null ? s.order : 0);
        ord.style.cssText = 'width:100%;padding:10px;border:2px solid #cbd5e0;border-radius:10px;';
        var ordWrap = document.createElement('div');
        var ol = document.createElement('div');
        ol.style.fontWeight = '600';
        ol.style.marginBottom = '4px';
        ol.textContent = 'Thứ tự';
        ordWrap.appendChild(ol);
        ordWrap.appendChild(ord);
        rowGrid.appendChild(ordWrap);

        card.appendChild(rowGrid);
        syncStickerSections(card);
        host.appendChild(card);
    });
}

function loadStickersAdmin(afterSave) {
    var st = document.getElementById('stickersAdminStatus');
    if (st) st.textContent = 'Đang tải sticker...';
    var url = SCRIPT_URL + '?action=getStickers';
    if (KPI_CONFIG_TOKEN) url += '&token=' + encodeURIComponent(KPI_CONFIG_TOKEN);
    jsonpRequest(url)
        .then(function(data) {
            stickersDraft = (data && data.ok && Array.isArray(data.stickers)) ? data.stickers.slice() : [];
            renderStickersEditor();
            if (st) {
                if (afterSave) {
                    st.textContent = 'Đã lưu — đã đồng bộ ' + stickersDraft.length + ' sticker từ server.';
                } else {
                    st.textContent = 'Đã tải ' + stickersDraft.length + ' sticker từ server (chỉnh sửa hoặc Xóa rồi Lưu sticker).';
                }
            }
        })
        .catch(function() {
            stickersDraft = [];
            renderStickersEditor();
            if (st) st.textContent = 'Không tải được danh sách sticker.';
        });
}

function saveStickersToServer() {
    var st = document.getElementById('stickersAdminStatus');
    var list = collectStickersFromEditor();
    stickersDraft = list;
    var json = JSON.stringify(list);

    function applyStickerSaveResult(res) {
        if (res && res.ok) {
            loadStickersAdmin(true);
        } else {
            if (st) st.textContent = 'Lưu thất bại.';
            var map = {
                panel_empty: 'Khung nội dung đang trống trong khi bật Hiển thị.',
                invalid_sticker_url: 'Thiếu URL ảnh https hoặc không hợp lệ.',
                unauthorized: 'Không được phép (token).'
            };
            var code = res && res.error;
            var msg = map[code] || code || 'unknown';
            alert('Không lưu được: ' + msg);
        }
    }

    if (st) st.textContent = 'Đang lưu...';

    if (json.length <= 7500) {
        var url = SCRIPT_URL + '?action=saveStickers&payload=' + encodeURIComponent(json);
        if (KPI_CONFIG_TOKEN) url += '&token=' + encodeURIComponent(KPI_CONFIG_TOKEN);
        jsonpRequest(url)
            .then(function(res) { applyStickerSaveResult(res); })
            .catch(function() {
                if (st) st.textContent = 'Lưu thất bại.';
                alert('Không lưu được sticker.');
            });
        return;
    }

    var form = document.createElement('form');
    form.method = 'POST';
    form.action = SCRIPT_URL;
    form.target = 'kpiStickerSaveFrame';
    form.style.display = 'none';
    function addField(name, val) {
        var inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = name;
        inp.value = val;
        form.appendChild(inp);
    }
    addField('action', 'saveStickersForm');
    try {
        addField('payloadB64', btoa(unescape(encodeURIComponent(json))));
    } catch (e64) {
        addField('payloadB64', btoa(json));
    }
    if (KPI_CONFIG_TOKEN) addField('token', KPI_CONFIG_TOKEN);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
    setTimeout(function() {
        if (st && st.textContent === 'Đang lưu...') {
            st.textContent = 'Đã gửi lưu (nếu không thấy “Đã lưu sticker”, tải lại trang để kiểm tra).';
        }
    }, 15000);
}

function loadMandatoryKpiHoursAdmin() {
    var inp = document.getElementById('mandatoryResearchKpiHoursInput');
    var st = document.getElementById('mandatoryKpiHoursStatus');
    if (!inp || !st) return;
    st.textContent = 'Đang tải...';
    fetchAppSettings()
        .then(function(data) {
            var raw = data && data.settings ? data.settings.mandatory_research_kpi_hours : null;
            var n = parseInt(String(raw != null && raw !== '' ? raw : '1760'), 10);
            if (isNaN(n) || n < 0) n = 1760;
            inp.value = String(n);
            st.textContent = 'Đã tải từ server. Sau khi lưu, người tra cứu trên user.html sẽ thấy số mới khi tải lại trang hoặc tra cứu lại.';
        })
        .catch(function() {
            inp.value = '1760';
            st.textContent = 'Không tải được cấu hình — hiển thị 1760.';
        });
}

function fetchAppSettings() {
    var url = SCRIPT_URL + '?action=getAppSettings';
    if (KPI_CONFIG_TOKEN) url += '&token=' + encodeURIComponent(KPI_CONFIG_TOKEN);
    return jsonpRequest(url);
}

function setAppSetting(key, value) {
    var url = SCRIPT_URL + '?action=setAppSetting&key=' + encodeURIComponent(key) + '&value=' + encodeURIComponent(String(value));
    if (KPI_CONFIG_TOKEN) url += '&token=' + encodeURIComponent(KPI_CONFIG_TOKEN);
    return jsonpRequest(url);
}

function jsonpRequest(url) {
    return new Promise(function(resolve, reject) {
        var cbName = '__cb_' + Math.random().toString(36).slice(2) + '_' + Date.now();
        var sep = url.indexOf('?') >= 0 ? '&' : '?';
        var full = url + sep + 'callback=' + encodeURIComponent(cbName);
        var script = document.createElement('script');
        var done = false;
        window[cbName] = function(data) {
            done = true;
            try { resolve(data); } finally {
                cleanup();
            }
        };
        function cleanup() {
            try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
            if (script && script.parentNode) script.parentNode.removeChild(script);
        }
        script.onerror = function() {
            if (done) return;
            cleanup();
            reject(new Error('jsonp_failed'));
        };
        script.src = full;
        document.head.appendChild(script);
        setTimeout(function() {
            if (done) return;
            cleanup();
            reject(new Error('jsonp_timeout'));
        }, 15000);
    });
}

function loadUserAllocationToggle() {
    var cb = document.getElementById('toggleUserAllocation');
    var st = document.getElementById('toggleUserAllocationStatus');
    if (!cb || !st) return;
    st.textContent = 'Đang tải cấu hình...';
    fetchAppSettings()
        .then(function(data) {
            var v = data && data.settings ? data.settings.userAllocationEnabled : null;
            var on = (v === true || v === 'true' || v === 1 || v === '1');
            cb.checked = !!on;
            st.textContent = on ? 'Đang bật.' : 'Đang tắt.';
        })
        .catch(function() {
            st.textContent = 'Không tải được cấu hình (vẫn dùng mặc định: tắt).';
            cb.checked = false;
        });
}

function goToUserPage() {
    window.location.href = 'user.html';
}

function updateStatus() {
    document.getElementById('statusIcon').textContent = '⏳';
    fetch(SCRIPT_URL)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            document.getElementById('statusIcon').textContent = '✅';
            var years = data.availableYears || [];
            document.getElementById('recordCount').textContent = years.length || '0';
            log('✓ Kết nối Google Sheets thành công', 'success');
        })
        .catch(function(error) {
            document.getElementById('statusIcon').textContent = '❌';
            document.getElementById('recordCount').textContent = 'Lỗi';
            log('⚠ Lỗi kết nối: ' + error.message, 'warning');
        });
}

function log(msg, type) {
    type = type || 'info';
    var logSection = document.getElementById('logSection');
    logSection.classList.remove('hidden');
    var line = document.createElement('div');
    if (type === 'error') line.className = 'error';
    if (type === 'warning') line.className = 'warning';
    if (type === 'success') line.className = 'success';
    line.textContent = new Date().toLocaleTimeString() + ': ' + msg;
    logSection.appendChild(line);
    logSection.scrollTop = logSection.scrollHeight;
}

var normalizeHeaderText = window.KpiCore.normalizeHeaderText;
var firstExistingColumn = window.KpiCore.firstExistingColumn;
var parseFlag = window.KpiCore.parseFlag;
var normalizeText = window.KpiCore.normalizeText;
var normalizeAuthorName = window.KpiCore.normalizeAuthorName;
var dedupSheetRows = window.KpiCore.dedupSheetRows;
var calculateScore = window.KpiCore.calculateScore;

function previewFile() {
    var file = document.getElementById('fileInput').files[0];
    if (!file) { 
        alert('Vui lòng chọn file!'); 
        return; 
    }
    
    document.getElementById('logSection').innerHTML = '';
    log('📄 Đang đọc file: ' + file.name);
    
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var data = new Uint8Array(e.target.result);
            var workbook = XLSX.read(data, { type: 'array' });
            
            var sheetName = null;
            var rawData = null;
            
            for (var s = 0; s < workbook.SheetNames.length; s++) {
                var testSheetName = workbook.SheetNames[s];
                var testName = testSheetName.toLowerCase();
                
                if (testName.indexOf('khai bao') !== -1 || testName.indexOf('huong dan') !== -1 || testName.indexOf('template') !== -1) {
                    log('⏭️ Bỏ qua sheet: ' + testSheetName, 'warning');
                    continue;
                }
                
                var testData = XLSX.utils.sheet_to_json(workbook.Sheets[testSheetName], { 
                    header: 1,
                    defval: '',
                    blankrows: false 
                });
                
                if (testData.length > 5) {
                    sheetName = testSheetName;
                    rawData = testData;
                    break;
                }
            }
            
            if (!sheetName || !rawData) {
                throw new Error('Không tìm thấy sheet có dữ liệu!');
            }
            
            log('✓ Đã đọc ' + rawData.length + ' dòng từ sheet: ' + sheetName);
            
            var headerRow = -1;
            for (var i = 0; i < Math.min(rawData.length, 10); i++) {
                var row = rawData[i];
                if (!row || row.length === 0) continue;
                
                var headerScore = 0;
                var keywords = ['nam', 'loai', 'hoat dong', 'xep hang', 'gio', 'tap chi', 'tac gia', 'cong trinh'];
                
                for (var j = 0; j < row.length; j++) {
                    var cell = (row[j] || '').toString().toLowerCase()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                        .replace(/đ/g, 'd');
                    
                    for (var k = 0; k < keywords.length; k++) {
                        if (cell.indexOf(keywords[k]) !== -1) {
                            headerScore++;
                            break;
                        }
                    }
                }
                
                if (headerScore >= 4) {
                    headerRow = i;
                    break;
                }
            }
            
            if (headerRow === -1) {
                log('⚠ Không tìm thấy header tự động, sử dụng dòng đầu tiên', 'warning');
                headerRow = 0;
            }
            
            log('✓ Tìm thấy header ở dòng ' + (headerRow + 1));
            currentFileData = { rawData: rawData, headerRow: headerRow };
            
            var previewData = rawData.slice(headerRow, Math.min(headerRow + 11, rawData.length));
            var tableHTML = '<thead><tr>';
            for (var h = 0; h < previewData[0].length; h++) {
                tableHTML += '<th>' + (previewData[0][h] || 'Cột ' + (h + 1)) + '</th>';
            }
            tableHTML += '</tr></thead><tbody>';
            
            for (var i = 1; i < previewData.length; i++) {
                tableHTML += '<tr>';
                for (var j = 0; j < previewData[i].length; j++) {
                    var cellText = (previewData[i][j] || '').toString();
                    tableHTML += '<td>' + (cellText.length > 50 ? cellText.substring(0, 50) + '...' : cellText) + '</td>';
                }
                tableHTML += '</tr>';
            }
            tableHTML += '</tbody>';
            document.getElementById('previewTable').innerHTML = tableHTML;
            
            document.getElementById('previewSection').classList.remove('hidden');
            document.getElementById('previewSection').scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            log('❌ LỖI: ' + error.message, 'error');
            alert('❌ Lỗi: ' + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function uploadToSheets() {
    if (!currentFileData) {
        alert('❌ Chưa có dữ liệu để upload!');
        return;
    }
    
    var uploadBtn = document.getElementById('uploadToSheetsBtn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = '⏳ Đang xử lý...';
    
    log('📄 Bắt đầu xử lý dữ liệu...', 'success');
    
    var rawData = currentFileData.rawData;
    var headerRow = currentFileData.headerRow;
    var headerCells = rawData[headerRow] || [];
    var headerMap = {};
    for (var h = 0; h < headerCells.length; h++) {
        var normalizedHeader = normalizeHeaderText(headerCells[h]);
        if (normalizedHeader && headerMap[normalizedHeader] === undefined) {
            headerMap[normalizedHeader] = h;
        }
    }

    var yearCol = firstExistingColumn(headerMap, ['nam', 'year'], 1);
    var activityTypeCol = firstExistingColumn(headerMap, ['loai hoat dong', 'nhom hoat dong'], 2);
    var rankingCol = firstExistingColumn(headerMap, ['xep hang', 'quartile', 'ranking'], 3);
    var hCol = firstExistingColumn(headerMap, ['gio toi da h max', 'h max', 'hmax', 'gio toi da', 'gio toida'], 4);
    var journalCol = firstExistingColumn(headerMap, ['ten tap chi', 'tap chi'], 5);
    var titleCol = firstExistingColumn(headerMap, ['ten cong trinh bai bao sang che de tai nghi', 'ten cong trinh', 'ten bai bao', 'ten bai', 'title'], 6);
    var authorsCol = firstExistingColumn(headerMap, ['danh sach tac gia', 'tac gia', 'authors'], 7);
    var firstAuthorCol = firstExistingColumn(headerMap, ['first author'], -1);
    var correspondingCol = firstExistingColumn(headerMap, ['corresponding author'], -1);
    var primaryOutsideCol = firstExistingColumn(headerMap, ['tac gia chinh ngoai vien'], -1);
    var inUnitAuthorCountCol = firstExistingColumn(headerMap, ['so tac gia thuoc vien'], -1);
    
    var dataByYear = {};
    var processedCount = 0;
    var skippedCount = 0;
    
    for (var i = headerRow + 1; i < rawData.length; i++) {
        var row = rawData[i];
        if (!row || row.length === 0) {
            continue;
        }
        
        if (row.length < 7) {
            log('⏭️ Dòng ' + (i+1) + ': Không đủ cột (' + row.length + '/7), bỏ qua', 'warning');
            skippedCount++;
            continue;
        }
        
        var year = (row[yearCol] || '').toString().trim();
        var activityType = (row[activityTypeCol] || '').toString().trim();
        var ranking = (row[rankingCol] || '').toString().trim();
        var H = parseInt(row[hCol]) || 600;
        var journal = (row[journalCol] || '').toString().trim();
        var title = (row[titleCol] || '').toString().trim();
        var authorsStr = (row[authorsCol] || '').toString().trim();
        var firstAuthorName = firstAuthorCol >= 0 ? (row[firstAuthorCol] || '').toString().trim() : '';
        var correspondingAuthorName = correspondingCol >= 0 ? (row[correspondingCol] || '').toString().trim() : '';
        var hasPrimaryOutside = primaryOutsideCol >= 0 ? parseFlag(row[primaryOutsideCol]) : false;
        var inUnitAuthorCountRaw = inUnitAuthorCountCol >= 0 ? parseInt(row[inUnitAuthorCountCol], 10) : NaN;
        
        if (!title || !authorsStr) {
            skippedCount++;
            continue;
        }
        
        if (!year) year = 'Unknown';
        
        var authorList = authorsStr.split(/[,;]/).map(function(a) { return a.trim(); }).filter(function(a) { return a; });
        var A = authorList.length;
        var K = 1;
        
        if (!dataByYear[year]) {
            dataByYear[year] = [[
                'Năm', 'STT', 'Loại hoạt động', 'Xếp hạng', 'Tên công trình', 'Tên tạp chí',
                'Tác giả', 'Role', 'Tổng tác giả', 'H_max', 'Điểm',
                'Tác giả chính ngoài Viện', 'Số tác giả thuộc Viện', 'First author', 'Corresponding author'
            ]];
        }
        
        for (var j = 0; j < authorList.length; j++) {
            var authorName = authorList[j];
            var role = 'coauthor';
            if (A === 1) {
                role = 'first';
            } else if (j === 0) {
                role = 'first';
            } else if (j === A - 1) {
                role = 'last';
            }
            
            var effectiveH = H;
            var inUnitCount = A;
            if (hasPrimaryOutside && !isNaN(inUnitAuthorCountRaw)) {
                inUnitCount = Math.max(0, Math.min(A, inUnitAuthorCountRaw));
                effectiveH = H * (inUnitCount / A);
            }
            var score = calculateScore(role, A, K, effectiveH);
            
            dataByYear[year].push([
                year,
                processedCount + 1,
                activityType,
                ranking,
                title,
                journal,
                authorName,
                role,
                A,
                H,
                score,
                hasPrimaryOutside ? 'true' : 'false',
                inUnitCount,
                firstAuthorName,
                correspondingAuthorName
            ]);
            processedCount++;
        }
    }
    
    log('📊 Đã xử lý ' + processedCount + ' bản ghi' + (skippedCount > 0 ? ' (bỏ qua ' + skippedCount + ' dòng)' : ''), 'success');

    var totalRemoved = 0;
    var years = Object.keys(dataByYear);
    for (var yi = 0; yi < years.length; yi++) {
        var yn = years[yi];
        var deduped = dedupSheetRows(dataByYear[yn]);
        if (deduped.removed > 0) {
            log('🧹 Loại trùng sheet "' + yn + '": -' + deduped.removed + ' bản ghi', 'warning');
            totalRemoved += deduped.removed;
        }
        dataByYear[yn] = deduped.rows;
    }
    if (totalRemoved > 0) {
        log('🧹 Tổng số bản ghi trùng đã loại: ' + totalRemoved, 'warning');
    }
    log('🚀 Đang đẩy lên Google Sheets theo từng năm...', 'success');

    var uploadPromises = [];

    for (var y = 0; y < years.length; y++) {
        var yearName = years[y];
        var sheetData = dataByYear[yearName];
        
        log('  → Đẩy ' + (sheetData.length - 1) + ' bản ghi vào sheet "' + yearName + '"', 'success');
        
        var promise = fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'write',
                sheetName: yearName,
                values: sheetData
            })
        });
        
        uploadPromises.push(promise);
    }
    
    Promise.all(uploadPromises)
        .then(function() {
            log('✅ Đã đẩy ' + processedCount + ' bản ghi vào ' + years.length + ' sheet theo năm!', 'success');
            alert('✅ Thành công!\n\n- Đã đẩy: ' + processedCount + ' bản ghi\n- Số sheet: ' + years.length + ' (' + years.join(', ') + ')\n- Kiểm tra Google Sheets để xem dữ liệu');
            
            document.getElementById('previewSection').classList.add('hidden');
            document.getElementById('fileInput').value = '';
            currentFileData = null;
            
            setTimeout(function() {
                updateStatus();
            }, 2000);
            
            uploadBtn.disabled = false;
            uploadBtn.textContent = '🚀 Đẩy lên Google Sheets';
        })
        .catch(function(error) {
            log('❌ Lỗi: ' + error.message, 'error');
            alert('❌ Lỗi khi đẩy dữ liệu: ' + error.message);
            uploadBtn.disabled = false;
            uploadBtn.textContent = '🚀 Đẩy lên Google Sheets';
        });
}

function cancelPreview() {
    document.getElementById('previewSection').classList.add('hidden');
    document.getElementById('fileInput').value = '';
    currentFileData = null;
}

(function initStickerSaveMessageListener() {
    if (window.__kpiStickerMsgBound) return;
    window.__kpiStickerMsgBound = true;
    window.addEventListener('message', function(ev) {
        var d = ev.data;
        if (!d || d.kpi !== 'saveStickers') return;
        var st = document.getElementById('stickersAdminStatus');
        var res = d.result || {};
        if (res.ok) {
            loadStickersAdmin(true);
        } else {
            if (st) st.textContent = 'Lưu thất bại.';
            var map = {
                panel_empty: 'Khung nội dung đang trống trong khi bật Hiển thị.',
                invalid_sticker_url: 'Thiếu URL ảnh https hoặc không hợp lệ.',
                unauthorized: 'Không được phép (token).'
            };
            var msg = map[res.error] || res.error || 'unknown';
            alert('Không lưu được: ' + msg);
        }
    });
})();

checkAuth();

document.getElementById('backBtn').addEventListener('click', goToUserPage);
document.getElementById('saveAdminSecurityBtn').addEventListener('click', saveAdminSecuritySettings);
document.getElementById('viewUserBtn').addEventListener('click', goToUserPage);
document.getElementById('adminKpiBrowseBtn').addEventListener('click', function() {
    window.location.href = 'admin-kpi.html';
});
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('previewBtn').addEventListener('click', previewFile);
document.getElementById('uploadToSheetsBtn').addEventListener('click', uploadToSheets);
document.getElementById('cancelBtn').addEventListener('click', cancelPreview);

document.getElementById('addAnnouncementBtn').addEventListener('click', function() {
    if (sessionStorage.getItem('adminAuth') !== 'true') return;
    announcementsDraft.push({
        id: 'ann_' + Date.now(),
        title: '',
        body: '',
        enabled: true,
        createdAt: new Date().toISOString()
    });
    renderAnnouncementsEditor();
    var st = document.getElementById('announcementsAdminStatus');
    if (st) st.textContent = 'Đã thêm thông báo nháp — nhớ nhấn Lưu.';
});
document.getElementById('saveAnnouncementsBtn').addEventListener('click', function() {
    if (sessionStorage.getItem('adminAuth') !== 'true') return;
    saveAnnouncementsToServer();
});

document.getElementById('addStickerBtn').addEventListener('click', function() {
    if (sessionStorage.getItem('adminAuth') !== 'true') return;
    stickersDraft.push({
        id: 'stk_' + Date.now(),
        enabled: false,
        stickerType: 'panel',
        panelBodyFormat: 'plain',
        title: '',
        imageUrl: '',
        htmlContent: '',
        linkUrl: '',
        position: 'br',
        maxWidthPx: 360,
        maxHeightPx: 420,
        zIndex: 50,
        order: stickersDraft.length,
        createdAt: new Date().toISOString()
    });
    renderStickersEditor();
    var st = document.getElementById('stickersAdminStatus');
    if (st) st.textContent = 'Đã thêm sticker nháp — nhớ nhấn Lưu.';
});
document.getElementById('saveStickersBtn').addEventListener('click', function() {
    if (sessionStorage.getItem('adminAuth') !== 'true') return;
    saveStickersToServer();
});
document.getElementById('reloadStickersBtn').addEventListener('click', function() {
    if (sessionStorage.getItem('adminAuth') !== 'true') return;
    if (!confirm('Tải lại danh sách sticker từ server?\n\nMọi thay đổi chưa Lưu sticker trên màn hình này sẽ bị bỏ.')) return;
    loadStickersAdmin(false);
});

(function() {
    var cb = document.getElementById('toggleUserAllocation');
    var st = document.getElementById('toggleUserAllocationStatus');
    if (!cb) return;
    cb.addEventListener('change', function() {
        if (sessionStorage.getItem('adminAuth') !== 'true') return;
        cb.disabled = true;
        if (st) st.textContent = 'Đang lưu...';
        setAppSetting('userAllocationEnabled', cb.checked ? 'true' : 'false')
            .then(function(res) {
                cb.disabled = false;
                if (st) st.textContent = cb.checked ? 'Đang bật.' : 'Đang tắt.';
                if (!(res && res.ok)) alert('Không lưu được cấu hình: ' + (res && res.error ? res.error : 'unknown'));
            })
            .catch(function() {
                cb.disabled = false;
                if (st) st.textContent = 'Không lưu được cấu hình.';
                alert('Không lưu được cấu hình.');
            });
    });
})();

(function() {
    var btn = document.getElementById('saveMandatoryKpiHoursBtn');
    if (!btn) return;
    btn.addEventListener('click', function() {
        if (sessionStorage.getItem('adminAuth') !== 'true') return;
        var inp = document.getElementById('mandatoryResearchKpiHoursInput');
        var st = document.getElementById('mandatoryKpiHoursStatus');
        if (!inp || !st) return;
        var n = parseInt(String(inp.value).trim(), 10);
        if (isNaN(n) || n < 0) {
            alert('Số giờ không hợp lệ (cần số nguyên ≥ 0).');
            return;
        }
        st.textContent = 'Đang lưu...';
        setAppSetting('mandatory_research_kpi_hours', String(n))
            .then(function(res) {
                if (!(res && res.ok)) {
                    st.textContent = 'Lưu thất bại.';
                    alert('Không lưu được: ' + (res && res.error ? res.error : 'unknown'));
                    return;
                }
                st.textContent = 'Đã lưu: ' + n + ' giờ. Cập nhật cho mọi phiên tra cứu sau khi họ tải lại trang hoặc tra cứu lại.';
            })
            .catch(function() {
                st.textContent = 'Lưu thất bại (mạng / Apps Script).';
                alert('Không lưu được cấu hình.');
            });
    });
})();
