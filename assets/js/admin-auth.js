(function (global) {
    'use strict';

    var AUTH_STORAGE_KEY = 'adminAuth';

    function getScriptUrl() {
        return (global.AppConfig && global.AppConfig.SCRIPT_URL) || '';
    }

    function getToken() {
        return (global.AppConfig && global.AppConfig.KPI_CONFIG_TOKEN) || '';
    }

    function isAuthenticated() {
        return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
    }

    function setAuthenticated(flag) {
        if (flag) {
            sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
        } else {
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
        }
    }

    function post(payload) {
        return fetch(getScriptUrl(), {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        });
    }

    function getStatus() {
        var url = getScriptUrl() + '?action=getAdminAuthStatus';
        var token = getToken();
        if (token) url += '&token=' + encodeURIComponent(token);
        return fetch(url).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        });
    }

    function mapError(code, extra) {
        var map = {
            invalid_password: 'Sai mật khẩu.',
            not_initialized: 'CSDL chưa thiết lập mật khẩu Admin. Vui lòng tải lại trang để thiết lập lần đầu.',
            already_initialized: 'Mật khẩu Admin đã được thiết lập trước đó.',
            password_too_short: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
            invalid_email: 'Địa chỉ email không hợp lệ.',
            no_recovery_email: 'Chưa cấu hình email khôi phục trong CSDL.',
            email_mismatch: 'Email không khớp với email khôi phục đã đăng ký.',
            mail_send_failed: 'Không gửi được email OTP (cần cấp quyền MailApp khi deploy Apps Script).',
            no_active_otp: 'Chưa có mã OTP hợp lệ. Hãy yêu cầu gửi lại mã.',
            otp_expired: 'Mã OTP đã hết hạn (10 phút). Hãy yêu cầu gửi lại mã mới.',
            otp_too_many_attempts: 'Nhập sai OTP quá 5 lần. Hãy yêu cầu gửi lại mã mới.',
            invalid_otp: 'Mã OTP không đúng' + (extra && typeof extra.remainingAttempts === 'number'
                ? (' (còn ' + extra.remainingAttempts + ' lần thử).')
                : '.'),
            nothing_to_update: 'Vui lòng nhập mật khẩu mới hoặc email khôi phục mới.'
        };
        return map[code] || ('Lỗi xác thực: ' + (code || 'không xác định'));
    }

    function bindAuthController(options) {
        var opts = options || {};
        var defaultSubtitle = opts.defaultSubtitle || 'Nhập mật khẩu để tiếp tục';
        var onAuthenticated = typeof opts.onAuthenticated === 'function' ? opts.onAuthenticated : function () {};
        var onStatusLoaded = typeof opts.onStatusLoaded === 'function' ? opts.onStatusLoaded : function () {};

        var authMeta = { initialized: true, hasRecoveryEmail: false, maskedEmail: '' };

        function byId(id) { return document.getElementById(id); }

        function setStatus(msg, isError) {
            var el = byId('authStatusMsg');
            if (!el) return;
            el.textContent = msg || '';
            el.classList.toggle('is-error', !!isError);
            el.classList.toggle('is-success', !isError && !!msg);
        }

        function showPanel(panel) {
            var loginBox = byId('loginFormBox');
            var setupBox = byId('setupFormBox');
            var forgotBox = byId('forgotFormBox');
            if (loginBox) loginBox.classList.toggle('hidden', panel !== 'login');
            if (setupBox) setupBox.classList.toggle('hidden', panel !== 'setup');
            if (forgotBox) forgotBox.classList.toggle('hidden', panel !== 'forgot');

            var sub = byId('authSubtitleText');
            if (sub) {
                if (panel === 'setup') sub.textContent = 'Thiết lập mật khẩu Admin lần đầu';
                else if (panel === 'forgot') sub.textContent = 'Khôi phục mật khẩu Admin qua email';
                else sub.textContent = defaultSubtitle;
            }
            setStatus('', false);
        }

        function refreshStatus() {
            return getStatus()
                .then(function (data) {
                    if (data && data.ok) {
                        authMeta = {
                            initialized: !!data.initialized,
                            hasRecoveryEmail: !!data.hasRecoveryEmail,
                            maskedEmail: data.maskedEmail || ''
                        };
                        var hint = byId('forgotEmailHint');
                        if (hint) {
                            hint.textContent = authMeta.maskedEmail
                                ? ('Nhập email khôi phục đã đăng ký (' + authMeta.maskedEmail + ') để nhận mã OTP.')
                                : 'Nhập email khôi phục đã đăng ký để nhận mã OTP.';
                        }
                        if (!isAuthenticated()) {
                            showPanel(authMeta.initialized ? 'login' : 'setup');
                        }
                        onStatusLoaded(authMeta);
                    }
                    return authMeta;
                })
                .catch(function () { return authMeta; });
        }

        function handleLogin() {
            var pwInput = byId('passwordInput');
            var password = pwInput ? pwInput.value : '';
            if (!password) {
                setStatus('Vui lòng nhập mật khẩu.', true);
                return;
            }
            var btn = byId('loginBtn');
            if (btn) { btn.disabled = true; btn.textContent = 'Đang kiểm tra...'; }
            setStatus('', false);

            post({ action: 'verifyAdminPassword', password: password })
                .then(function (res) {
                    if (res && res.ok) {
                        setAuthenticated(true);
                        if (pwInput) pwInput.value = '';
                        onAuthenticated();
                        refreshStatus();
                    } else if (res && res.error === 'not_initialized') {
                        showPanel('setup');
                    } else {
                        setStatus(mapError(res && res.error, res), true);
                    }
                })
                .catch(function (err) {
                    setStatus('Không kết nối được máy chủ xác thực: ' + (err && err.message ? err.message : err), true);
                })
                .finally(function () {
                    if (btn) { btn.disabled = false; btn.textContent = 'Đăng nhập'; }
                });
        }

        function handleSetup() {
            var pw = (byId('setupPasswordInput') || {}).value || '';
            var pw2 = (byId('setupPasswordConfirmInput') || {}).value || '';
            var email = ((byId('setupEmailInput') || {}).value || '').trim();

            if (pw.length < 6) { setStatus('Mật khẩu phải có ít nhất 6 ký tự.', true); return; }
            if (pw !== pw2) { setStatus('Mật khẩu nhập lại không khớp.', true); return; }
            if (!email) { setStatus('Vui lòng nhập email khôi phục.', true); return; }

            var btn = byId('setupSubmitBtn');
            if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }

            post({ action: 'setupAdminPassword', password: pw, recoveryEmail: email })
                .then(function (res) {
                    if (res && res.ok) {
                        setAuthenticated(true);
                        onAuthenticated();
                        refreshStatus();
                    } else {
                        setStatus(mapError(res && res.error, res), true);
                    }
                })
                .catch(function (err) {
                    setStatus('Lỗi kết nối: ' + (err && err.message ? err.message : err), true);
                })
                .finally(function () {
                    if (btn) { btn.disabled = false; btn.textContent = 'Thiết lập & Đăng nhập'; }
                });
        }

        function handleSendOtp() {
            var email = ((byId('forgotEmailInput') || {}).value || '').trim();
            if (!email) { setStatus('Vui lòng nhập email khôi phục.', true); return; }

            var btn = byId('sendOtpBtn');
            if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi OTP...'; }
            setStatus('', false);

            post({ action: 'requestPasswordReset', email: email })
                .then(function (res) {
                    if (res && res.ok) {
                        var step2 = byId('forgotStep2');
                        if (step2) step2.classList.remove('hidden');
                        setStatus('Đã gửi mã OTP về ' + (res.maskedEmail || 'email khôi phục') + '.', false);
                    } else {
                        setStatus(mapError(res && res.error, res), true);
                    }
                })
                .catch(function (err) {
                    setStatus('Lỗi kết nối: ' + (err && err.message ? err.message : err), true);
                })
                .finally(function () {
                    if (btn) { btn.disabled = false; btn.textContent = 'Gửi mã OTP về email'; }
                });
        }

        function handleResetPassword() {
            var otp = ((byId('resetOtpInput') || {}).value || '').trim();
            var pw = (byId('resetNewPasswordInput') || {}).value || '';
            var pw2 = (byId('resetConfirmPasswordInput') || {}).value || '';

            if (!otp) { setStatus('Vui lòng nhập mã OTP.', true); return; }
            if (pw.length < 6) { setStatus('Mật khẩu mới phải có ít nhất 6 ký tự.', true); return; }
            if (pw !== pw2) { setStatus('Mật khẩu nhập lại không khớp.', true); return; }

            var btn = byId('resetPasswordBtn');
            if (btn) { btn.disabled = true; btn.textContent = 'Đang đặt lại...'; }

            post({ action: 'resetAdminPassword', otp: otp, newPassword: pw })
                .then(function (res) {
                    if (res && res.ok) {
                        if (byId('resetOtpInput')) byId('resetOtpInput').value = '';
                        if (byId('resetNewPasswordInput')) byId('resetNewPasswordInput').value = '';
                        if (byId('resetConfirmPasswordInput')) byId('resetConfirmPasswordInput').value = '';
                        if (byId('forgotStep2')) byId('forgotStep2').classList.add('hidden');
                        showPanel('login');
                        setStatus('Đặt lại mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.', false);
                    } else {
                        setStatus(mapError(res && res.error, res), true);
                    }
                })
                .catch(function (err) {
                    setStatus('Lỗi kết nối: ' + (err && err.message ? err.message : err), true);
                })
                .finally(function () {
                    if (btn) { btn.disabled = false; btn.textContent = 'Đặt lại mật khẩu'; }
                });
        }

        if (byId('loginBtn')) byId('loginBtn').addEventListener('click', handleLogin);
        if (byId('passwordInput')) {
            byId('passwordInput').addEventListener('keypress', function (e) {
                if (e.key === 'Enter') handleLogin();
            });
        }
        if (byId('openForgotBtn')) {
            byId('openForgotBtn').addEventListener('click', function () {
                if (byId('forgotStep2')) byId('forgotStep2').classList.add('hidden');
                showPanel('forgot');
            });
        }
        if (byId('backToLoginBtn')) {
            byId('backToLoginBtn').addEventListener('click', function () {
                showPanel('login');
            });
        }
        if (byId('setupSubmitBtn')) byId('setupSubmitBtn').addEventListener('click', handleSetup);
        if (byId('sendOtpBtn')) byId('sendOtpBtn').addEventListener('click', handleSendOtp);
        if (byId('resetPasswordBtn')) byId('resetPasswordBtn').addEventListener('click', handleResetPassword);

        return {
            showPanel: showPanel,
            refreshStatus: refreshStatus,
            setStatus: setStatus,
            getMeta: function () { return authMeta; }
        };
    }

    global.AdminAuth = {
        isAuthenticated: isAuthenticated,
        setAuthenticated: setAuthenticated,
        post: post,
        getStatus: getStatus,
        mapError: mapError,
        bindAuthController: bindAuthController
    };
})(window);
