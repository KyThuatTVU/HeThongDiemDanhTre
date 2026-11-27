import { api, setCsrfToken } from '../../core/http.js';
import {
    applyLoginPayload,
    consumeLoginNotice,
    LAST_USER_KEY,
    LOGOUT_SIGNAL_KEY
} from '../../core/auth.js';
import { DASHBOARD_URL, PAGES, pageUrl } from '../../core/config.js';
import { flash } from '../../core/flash.js';
import { setLoading, queryParam } from '../../core/dom.js';

const REMEMBER_USER_KEY = 'hk_remembered_username';

const form = document.querySelector('[data-login-form]');
const alertBox = document.querySelector('[data-login-alert]');
const noticeBox = document.querySelector('[data-login-notice]');
const submit = document.querySelector('[data-login-submit]');
const googleLink = document.querySelector('[data-google-login]');
const rememberCheckbox = document.querySelector('[data-remember-username]');
const capsLockHint = document.querySelector('[data-capslock-hint]');

function showAlert(message) {
    if (!alertBox) {
        return;
    }
    alertBox.textContent = message;
    alertBox.hidden = false;
}

function showNotice(message, tone = 'info') {
    if (!noticeBox || !message) {
        return;
    }
    noticeBox.textContent = message;
    noticeBox.classList.toggle('login-notice--warning', tone === 'warning');
    noticeBox.hidden = false;
}

function clearErrors() {
    form.querySelectorAll('.is-invalid').forEach((input) => input.classList.remove('is-invalid'));
    form.querySelectorAll('[data-error-for]').forEach((node) => {
        node.textContent = '';
        node.classList.remove('d-block');
    });
    if (alertBox) {
        alertBox.hidden = true;
    }
}

function showFieldErrors(errors = {}) {
    Object.entries(errors).forEach(([field, messages]) => {
        const input = form.querySelector(`[name="${field}"]`);
        const feedback = form.querySelector(`[data-error-for="${field}"]`);
        if (input) {
            input.classList.add('is-invalid');
        }
        if (feedback) {
            feedback.textContent = Array.isArray(messages) ? messages.join(' ') : String(messages);
            feedback.classList.add('d-block');
        }
    });
}

function safeReturnUrl(data) {
    try {
        const next = sessionStorage.getItem('hk_login_next') || '';
        const lastUserId = sessionStorage.getItem(LAST_USER_KEY) || '';
        sessionStorage.removeItem('hk_login_next');
        sessionStorage.removeItem(LAST_USER_KEY);

        if (!next || !next.startsWith('/') || next.startsWith('//')) {
            return null;
        }
        // Không quay lại trang đăng nhập hoặc chọn cơ sở
        if (next.includes('/auth/login') || next.includes('/auth/select-branch')) {
            return null;
        }
        // Trên máy dùng chung: chỉ quay lại trang cũ nếu đúng cùng 1 tài khoản vừa bị hết phiên
        if (lastUserId && String(data?.user?.id || '') !== lastUserId) {
            return null;
        }
        return next;
    } catch {
        return null;
    }
}

function landingUrl(data) {
    if (!data?.current_branch_id && (data?.branches || []).length > 0) {
        return pageUrl(PAGES.selectBranch);
    }
    const returnUrl = safeReturnUrl(data);
    if (returnUrl) {
        return returnUrl;
    }
    if (data?.role?.key === 'attendance_staff') {
        return pageUrl(PAGES.attendanceToday);
    }
    return DASHBOARD_URL;
}

function markFreshLoginActivity() {
    try {
        localStorage.setItem('hk_last_activity_at', String(Date.now()));
        localStorage.removeItem(LOGOUT_SIGNAL_KEY);
    } catch {
        // Bỏ qua
    }
}

async function checkExistingSession() {
    try {
        const payload = await api.get('/auth/me');
        if (payload?.data?.csrf_token) {
            setCsrfToken(payload.data.csrf_token);
        }
        markFreshLoginActivity();
        window.location.replace(landingUrl(payload?.data));
        return true;
    } catch {
        return false;
    }
}

async function loadGoogleAvailability() {
    if (!googleLink) {
        return;
    }
    try {
        const payload = await api.get('/auth/google-url');
        const url = payload?.data?.url;
        if (url) {
            googleLink.href = url;
            googleLink.hidden = false;
            document.querySelector('[data-login-divider]')?.removeAttribute('hidden');
        }
    } catch {
        googleLink.hidden = true;
    }
}

function initRememberedUsername() {
    if (!form?.identifier) {
        return;
    }
    try {
        const saved = localStorage.getItem(REMEMBER_USER_KEY);
        if (saved) {
            form.identifier.value = saved;
            if (rememberCheckbox) {
                rememberCheckbox.checked = true;
            }
            form.password?.focus();
        } else {
            form.identifier.focus();
        }
    } catch {
        // Bỏ qua
    }
}

function updateCapsLockHint(event) {
    if (!capsLockHint || typeof event.getModifierState !== 'function') {
        return;
    }
    capsLockHint.hidden = !event.getModifierState('CapsLock');
}

form?.password?.addEventListener('keydown', updateCapsLockHint);
form?.password?.addEventListener('keyup', updateCapsLockHint);
form?.password?.addEventListener('blur', () => {
    if (capsLockHint) {
        capsLockHint.hidden = true;
    }
});

document.querySelector('[data-action="toggle-password"]')?.addEventListener('click', (event) => {
    const button = event.currentTarget;
    const input = form.querySelector('[name="password"]');
    const icon = button.querySelector('i');
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    icon.className = `bi ${showing ? 'bi-eye' : 'bi-eye-slash'}`;
});

form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();

    const identifier = form.identifier.value.trim();
    const password = form.password.value;
    form.identifier.value = identifier;

    if (!identifier || !password) {
        showFieldErrors({
            identifier: identifier ? [] : ['Vui lòng nhập tên đăng nhập hoặc email'],
            password: password ? [] : ['Vui lòng nhập mật khẩu']
        });
        return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        showAlert('Máy đang mất kết nối mạng. Vui lòng kiểm tra Wi-Fi / 4G rồi thử lại.');
        return;
    }

    setLoading(submit, true, 'Đang đăng nhập...');
    try {
        const payload = await api.post('/auth/login', { identifier, password });
        const data = payload?.data;
        if (!data?.user) {
            throw new Error('Phản hồi đăng nhập không hợp lệ');
        }
        try {
            if (rememberCheckbox?.checked) {
                localStorage.setItem(REMEMBER_USER_KEY, identifier);
            } else {
                localStorage.removeItem(REMEMBER_USER_KEY);
            }
        } catch {
            // Bỏ qua
        }
        applyLoginPayload(data);
        markFreshLoginActivity();
        flash(`Xin chào ${data.user.full_name || data.user.username}!`, 'success');
        window.location.replace(landingUrl(data));
    } catch (error) {
        if (error.status === 422) {
            showFieldErrors(error.errors);
        }
        if (error.status === 401) {
            showAlert('Tên đăng nhập hoặc mật khẩu không đúng. Hãy kiểm tra lại chữ hoa/thường và thử lại.');
        } else if (error.status === 403) {
            showAlert(error.message || 'Tài khoản đang bị khoá hoặc chưa được phân công cơ sở.');
        } else if (error.status === 429) {
            showAlert(error.message || 'Bạn nhập sai quá nhiều lần. Vui lòng chờ vài phút rồi thử lại hoặc nhờ quản trị viên hỗ trợ.');
        } else {
            showAlert(error.message || 'Không đăng nhập được, vui lòng thử lại.');
        }
    } finally {
        setLoading(submit, false);
    }
});

const yearNode = document.querySelector('[data-login-year]');
if (yearNode) {
    yearNode.textContent = String(new Date().getFullYear());
}

const persistedNotice = consumeLoginNotice();
if (persistedNotice?.message) {
    showNotice(persistedNotice.message, persistedNotice.tone);
}

initRememberedUsername();

const oauthStatus = queryParam('oauth');
if (oauthStatus === 'error') {
    showAlert(queryParam('message') || 'Đăng nhập Google không thành công. Vui lòng thử lại.');
} else {
    checkExistingSession();
}
loadGoogleAvailability();
