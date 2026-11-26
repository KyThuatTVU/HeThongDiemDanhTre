// Trạng thái phiên đăng nhập & phân quyền phía client
import { api, setCsrfToken } from './http.js';
import { LOGIN_URL } from './config.js';

export const session = {
    user: null,
    role: null,
    permissions: [],
    branches: [],
    currentBranchId: null,
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

export function redirectToLogin() {
    const next = window.location.pathname + window.location.search;
    sessionStorage.setItem('hk_login_next', next);
    window.location.replace(LOGIN_URL);
}

export async function logout() {
    try {
        await api.post('/auth/logout');
    } catch {
        // Phiên đã hết hạn thì vẫn đưa về trang đăng nhập
    }
    session.loaded = false;
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
