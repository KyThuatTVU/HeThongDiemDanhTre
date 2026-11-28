// Trạng thái phiên đăng nhập & phân quyền phía client
import { api, setCsrfToken } from './http.js';
import { LOGIN_URL } from './config.js';

export const session = {
    user: null,
    role: null,
    permissions: [],
    branches: [],
    currentBranchId: null,
    idleTimeoutMinutes: 30,
    remembered: false,
    rememberDays: 30,
    googleLoginEnabled: false,
    loaded: false
};

let pending = null;

function applyPayload(data) {
    if (!data?.user) {
        throw new Error('Dữ liệu phiên đăng nhập không hợp lệ');
    }
    session.user = data.user;
    session.role = data.role || null;
    session.permissions = data.permissions || [];
    session.branches = data.branches || [];
    session.currentBranchId = data.current_branch_id ?? null;
    session.idleTimeoutMinutes = Math.max(5, Number(data.idle_timeout_minutes || 30));
    session.remembered = Boolean(data.remembered);
    session.rememberDays = Math.max(1, Number(data.remember_days || 30));
    session.googleLoginEnabled = Boolean(data.google_login_enabled);
    session.loaded = true;
    if (data.csrf_token) {
        setCsrfToken(data.csrf_token);
    }
}

export async function loadMe(force = false) {
    if (session.loaded && !force) {
        return session;
    }
    if (!pending || force) {
        pending = (async () => {
            const payload = await api.get('/auth/me');
            applyPayload(payload?.data);
            return session;
        })();
    }
    try {
        return await pending;
    } finally {
        pending = null;
    }
}

export function applyLoginPayload(payload) {
    applyPayload(payload);
}

export function can(permission) {
    if (!permission) {
        return true;
    }
    if (session.role?.key === 'super_admin') {
        return true;
    }
    return session.permissions.includes(permission);
}

export function currentBranch() {
    return session.branches.find((branch) => Number(branch.id) === Number(session.currentBranchId)) || null;
}

export async function requireAuth() {
    try {
        await loadMe();
        return true;
    } catch (error) {
        if (error?.status === 401) {
            redirectToLogin();
            return false;
        }
        throw error;
    }
}

export const LOGOUT_SIGNAL_KEY = 'hk_logout_at';
export const LOGIN_NOTICE_KEY = 'hk_login_notice';
export const LAST_USER_KEY = 'hk_last_user_id';

export function skipBeforeUnload() {
    window.__hkSkipBeforeUnload = true;
}

export function setLoginNotice(message, tone = 'info') {
    if (!message) {
        return;
    }
    try {
        localStorage.setItem(LOGIN_NOTICE_KEY, JSON.stringify({
            message,
            tone,
            at: Date.now()
        }));
    } catch {
        // Bỏ qua nếu trình duyệt chặn storage
    }
}

export function consumeLoginNotice() {
    try {
        const raw = localStorage.getItem(LOGIN_NOTICE_KEY);
        if (!raw) {
            return null;
        }
        localStorage.removeItem(LOGIN_NOTICE_KEY);
        const parsed = JSON.parse(raw);
        // Chỉ hiển thị thông báo trong vòng 24 giờ gần nhất
        if (!parsed?.message || (Date.now() - Number(parsed.at || 0)) > 24 * 60 * 60 * 1000) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function broadcastLogout() {
    try {
        localStorage.setItem(LOGOUT_SIGNAL_KEY, String(Date.now()));
    } catch {
        // Bỏ qua
    }
}

export function rememberReturnPath() {
    try {
        const next = window.location.pathname + window.location.search;
        sessionStorage.setItem('hk_login_next', next);
        if (session.user?.id) {
            sessionStorage.setItem(LAST_USER_KEY, String(session.user.id));
        }
    } catch {
        // Bỏ qua
    }
}

export function redirectToLogin(options = {}) {
    if (options.rememberNext !== false) {
        rememberReturnPath();
    }
    if (options.notice) {
        setLoginNotice(options.notice, options.tone || 'info');
    }
    skipBeforeUnload();
    window.location.replace(LOGIN_URL);
}

export async function logout(options = {}) {
    skipBeforeUnload();
    if (options.rememberNext) {
        rememberReturnPath();
    } else {
        try {
            sessionStorage.removeItem('hk_login_next');
        } catch {
            // Bỏ qua
        }
    }
    if (options.notice) {
        setLoginNotice(options.notice, options.tone || 'info');
    }
    if (!options.skipServer) {
        try {
            await api.post('/auth/logout');
        } catch {
            // Phiên đã hết hạn thì vẫn đưa về trang đăng nhập
        }
    }
    session.loaded = false;
    if (options.broadcast !== false) {
        broadcastLogout();
    }
    window.location.replace(LOGIN_URL);
}

export function applyPermissionGuards(root = document) {
    root.querySelectorAll('[data-permission]').forEach((element) => {
        if (!can(element.dataset.permission)) {
            element.hidden = true;
        }
    });
}

export async function selectBranch(branchId) {
    const payload = await api.post('/auth/select-branch', { branch_id: Number(branchId) });
    session.currentBranchId = payload?.data?.current_branch_id ?? Number(branchId);
    return session.currentBranchId;
}
