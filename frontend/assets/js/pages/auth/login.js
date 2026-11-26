import { api, setCsrfToken } from '../../core/http.js';
import { applyLoginPayload, session, redirectToLogin } from '../../core/auth.js';
import { DASHBOARD_URL, PAGES, pageUrl } from '../../core/config.js';
import { flash } from '../../core/flash.js';
import { setLoading, queryParam } from '../../core/dom.js';

const form = document.querySelector('[data-login-form]');
const alertBox = document.querySelector('[data-login-alert]');
const submit = document.querySelector('[data-login-submit]');
const googleLink = document.querySelector('[data-google-login]');

function showAlert(message) {
    if (!alertBox) {
        return;
    }
    alertBox.textContent = message;
    alertBox.hidden = false;
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

async function checkExistingSession() {
    try {
        const payload = await api.get('/auth/me');
        if (payload?.data?.csrf_token) {
            setCsrfToken(payload.data.csrf_token);
        }
        window.location.replace(DASHBOARD_URL);
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

    if (!identifier || !password) {
        showFieldErrors({
            identifier: identifier ? [] : ['Vui lòng nhập tên đăng nhập hoặc email'],
            password: password ? [] : ['Vui lòng nhập mật khẩu']
        });
        return;
    }

    setLoading(submit, true, 'Đang đăng nhập...');
    try {
        const payload = await api.post('/auth/login', { identifier, password });
        const data = payload?.data;
        if (!data?.user) {
            throw new Error('Phản hồi đăng nhập không hợp lệ');
        }
        applyLoginPayload(data);
        flash(`Xin chào ${data.user.full_name || data.user.username}!`, 'success');
        if (!data.current_branch_id && (data.branches || []).length > 0) {
            window.location.replace(pageUrl(PAGES.selectBranch));
            return;
        }
        window.location.replace(DASHBOARD_URL);
    } catch (error) {
        if (error.status === 422) {
            showFieldErrors(error.errors);
        }
        if (error.status === 401) {
            showAlert('Tên đăng nhập hoặc mật khẩu không đúng.');
        } else if (error.status === 403) {
            showAlert(error.message || 'Tài khoản đang bị khoá hoặc chưa được phân công cơ sở.');
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

const oauthStatus = queryParam('oauth');
if (oauthStatus === 'error') {
    showAlert(queryParam('message') || 'Đăng nhập Google không thành công. Vui lòng thử lại.');
} else if (oauthStatus === 'success') {
    checkExistingSession();
} else {
    checkExistingSession();
    loadGoogleAvailability();
}
