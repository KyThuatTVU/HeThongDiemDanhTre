// HTTP client: session cookie, CSRF, chuẩn hoá lỗi API
import { API_BASE } from './config.js';

let csrfToken = null;
let csrfPromise = null;
let lastServerTouchAt = Date.now();

export function getLastServerTouch() {
    return lastServerTouchAt;
}

export function markServerTouched(ts = Date.now()) {
    lastServerTouchAt = ts;
}

export class ApiError extends Error {
    constructor(message, status, errors = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.errors = errors || {};
    }
}

export function setCsrfToken(token) {
    csrfToken = token || null;
}

export async function ensureCsrf(force = false) {
    if (csrfToken && !force) {
        return csrfToken;
    }
    if (csrfPromise && !force) {
        return csrfPromise;
    }
    csrfPromise = (async () => {
        const response = await fetch(`${API_BASE}/auth/csrf`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
            throw new ApiError('Không lấy được mã bảo vệ phiên làm việc', response.status);
        }
        const payload = await response.json();
        csrfToken = payload?.data?.csrf_token || null;
        return csrfToken;
    })();
    try {
        return await csrfPromise;
    } finally {
        csrfPromise = null;
    }
}

function buildUrl(path, query) {
    const url = new URL(API_BASE + path);
    if (query && typeof query === 'object') {
        Object.entries(query).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') {
                return;
            }
            url.searchParams.set(key, String(value));
        });
    }
    return url.toString();
}

async function parseBody(response) {
    const text = await response.text();
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

async function request(method, path, options = {}) {
    const { query, body, form, retried = false } = options;
    const url = buildUrl(path, query);
    const headers = { Accept: 'application/json' };
    let payloadBody;

    if (method !== 'GET') {
        const token = await ensureCsrf(retried);
        headers['X-CSRF-Token'] = token || '';
    }
    if (form instanceof FormData) {
        payloadBody = form;
    } else if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payloadBody = JSON.stringify(body);
    }

    let response;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutMs = Number(options.timeoutMs || 20000);
    const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
        response = await fetch(url, {
            method,
            credentials: 'same-origin',
            headers,
            body: payloadBody,
            signal: controller?.signal
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new ApiError('Kết nối máy chủ quá chậm. Vui lòng kiểm tra mạng rồi thử lại.', 0);
        }
        throw new ApiError('Không kết nối được máy chủ. Kiểm tra mạng hoặc Apache/MySQL rồi thử lại.', 0);
    } finally {
        if (timer !== null) {
            window.clearTimeout(timer);
        }
    }

    if (response.status === 419 && !retried) {
        csrfToken = null;
        return request(method, path, { ...options, retried: true });
    }

    const payload = await parseBody(response);

    if (!response.ok) {
        if (response.status === 401) {
            window.dispatchEvent(new CustomEvent('hk:session-expired', {
                detail: { message: payload?.message || '' }
            }));
        }
        throw new ApiError(
            payload?.message || `Yêu cầu thất bại (HTTP ${response.status})`,
            response.status,
            payload?.errors || {}
        );
    }

    lastServerTouchAt = Date.now();
    return payload;
}

export const api = {
    get(path, query) {
        return request('GET', path, { query });
    },
    post(path, body, query) {
        return request('POST', path, { body, query });
    },
    put(path, body, query) {
        return request('PUT', path, { body, query });
    },
    delete(path, body, query) {
        return request('DELETE', path, { body, query });
    },
    upload(method, path, form) {
        return request(method, path, { form });
    }
};
