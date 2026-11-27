import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { renderPagination } from '../../../../components/pagination/pagination.js';
import { createModal } from '../../../../components/modal/modal.js';
import { datetime, labels, number } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

const ACTION_META = {
    create: { label: 'Tạo mới', tone: 'success' },
    update: { label: 'Cập nhật', tone: 'info' },
    delete: { label: 'Xoá', tone: 'danger' },
    restore: { label: 'Khôi phục', tone: 'success' },
    lock: { label: 'Khoá', tone: 'warning' },
    unlock: { label: 'Mở khoá', tone: 'success' },
    reset_password: { label: 'Đặt lại mật khẩu', tone: 'warning' },
    assign_branches: { label: 'Phân công cơ sở', tone: 'info' },
    update_avatar: { label: 'Đổi ảnh đại diện', tone: 'neutral' },
    update_logo: { label: 'Đổi logo', tone: 'neutral' },
    transfer_branch: { label: 'Chuyển cơ sở', tone: 'info' },
    generate: { label: 'Tạo bảng học phí', tone: 'info' },
    collect: { label: 'Thu học phí', tone: 'success' },
    adjust: { label: 'Điều chỉnh học phí', tone: 'warning' },
    save: { label: 'Lưu điểm danh', tone: 'info' },
    lock_session: { label: 'Khoá sổ điểm danh', tone: 'warning' },
    unlock_session: { label: 'Mở khoá sổ', tone: 'success' },
    update_settings: { label: 'Cập nhật cấu hình', tone: 'warning' },
    login: { label: 'Đăng nhập', tone: 'info' },
    logout: { label: 'Đăng xuất', tone: 'neutral' }
};

const MODULE_LABELS = {
    students: 'Học viên',
    classes: 'Lớp học',
    attendance: 'Điểm danh',
    tuition: 'Học phí',
    staff: 'Nhân sự',
    branches: 'Cơ sở',
    settings: 'Cấu hình',
    auth: 'Đăng nhập'
};

const activityRows = new Map();
const loginRows = [];

const activityTable = createTable(qs('[data-activity-table]'), {
    emptyTitle: 'Chưa có nhật ký',
    emptyHint: 'Chưa có hoạt động phù hợp với bộ lọc hiện tại.',
    emptyIcon: 'bi-activity',
    columns: [
        { label: 'Thời gian', mobileHide: true, render: (row) => escapeHtml(datetime(row.created_at)) },
        { label: 'Người thực hiện', mobileHide: true, render: (row) => escapeHtml(row.user_name || 'Hệ thống') },
        {
            label: 'Thao tác',
            render: (row) => {
                const meta = ACTION_META[row.action] || { label: row.action || '—', tone: 'neutral' };
                return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>
                    <span class="cell-meta">${escapeHtml(MODULE_LABELS[row.module] || row.module || '')}<span class="hk-mobile-only"> · ${escapeHtml(row.user_name || 'Hệ thống')}</span></span>
                    <span class="cell-meta hk-mobile-only">${escapeHtml(datetime(row.created_at))}</span>`;
            }
        },
        {
            label: 'Nội dung',
            mobileHide: true,
            render: (row) => row.description
                ? escapeHtml(row.description)
                : '<span class="text-muted-2">—</span>'
        },
        {
            label: 'Đối tượng',
            mobileHide: true,
            render: (row) => {
                if (!row.target_type) {
                    return '<span class="text-muted-2">—</span>';
                }
                const target = row.target_id ? `${row.target_type} #${row.target_id}` : row.target_type;
                return `<span class="cell-meta">${escapeHtml(target)}</span>`;
            }
        },
        { label: 'IP', mobileHide: true, render: (row) => escapeHtml(row.ip_address || '—') },
        {
            label: '',
            headerClass: 'text-end',
            className: 'text-end',
            render: (row) => `<button type="button" class="btn btn-sm btn-light" data-action="detail" data-id="${row.id}" title="Chi tiết"><i class="bi bi-eye"></i><span class="hk-mobile-only ms-1">Chi tiết</span></button>`
        }
    ]
});

const loginTable = createTable(qs('[data-login-table]'), {
    emptyTitle: 'Chưa có lịch sử đăng nhập',
    emptyHint: 'Chưa có lần đăng nhập nào phù hợp với bộ lọc hiện tại.',
    emptyIcon: 'bi-box-arrow-in-right',
    columns: [
        { label: 'Thời gian', mobileHide: true, render: (row) => escapeHtml(datetime(row.created_at)) },
        {
            label: 'Người dùng',
            render: (row) => {
                const title = row.user_name
                    ? escapeHtml(row.user_name)
                    : escapeHtml(row.attempted_identifier || 'Không xác định');
                const sub = row.user_name
                    ? escapeHtml(row.attempted_identifier || '')
                    : 'Tài khoản không tồn tại hoặc bị khoá';
                return `<span class="cell-title">${title}</span>
                    <span class="cell-meta hk-desktop-only">${sub}</span>
                    <span class="cell-meta hk-mobile-only">${escapeHtml(datetime(row.created_at))}</span>`;
            }
        },
        { label: 'Phương thức', mobileHide: true, render: (row) => escapeHtml(labels.loginMethod(row.login_method)) },
        {
            label: 'Kết quả',
            render: (row) => row.status === 'success'
                ? '<span class="hk-badge hk-badge--success">Thành công</span>'
                : '<span class="hk-badge hk-badge--danger">Thất bại</span>'
        },
        { label: 'IP', mobileHide: true, render: (row) => escapeHtml(row.ip_address || '—') },
        {
            label: 'Thiết bị',
            mobileHide: true,
            render: (row) => {
                if (!row.user_agent) {
                    return '<span class="text-muted-2">—</span>';
                }
                const agent = String(row.user_agent);
                const short = agent.length > 46 ? `${agent.slice(0, 46)}…` : agent;
                return `<span class="cell-meta" title="${escapeHtml(agent)}">${escapeHtml(short)}</span>`;
            }
        },
        {
            label: '',
            headerClass: 'text-end hk-col-mobile-only',
            className: 'text-end hk-col-mobile-only',
            render: (_row, index) => `<button type="button" class="btn btn-sm btn-light" data-login-detail="${index}">Chi tiết</button>`
        }
    ]
});

const activityPagination = qs('[data-activity-pagination]');
const loginPagination = qs('[data-login-pagination]');
const activityTotal = qs('[data-activity-total]');
const loginTotal = qs('[data-login-total]');

const activityState = { page: 1, loading: false };
const loginState = { page: 1, loaded: false, loading: false };

function activityQuery() {
    const params = new URLSearchParams();
    params.set('page', String(activityState.page));
    const module = qs('[data-activity-module]')?.value;
    const from = qs('[data-activity-from]')?.value;
    const to = qs('[data-activity-to]')?.value;
    if (module) {
        params.set('module', module);
    }
    if (from) {
        params.set('date_from', from);
    }
    if (to) {
        params.set('date_to', to);
    }
    return params.toString();
}

function loginQuery() {
    const params = new URLSearchParams();
    params.set('page', String(loginState.page));
    const status = qs('[data-login-status]')?.value;
    const from = qs('[data-login-from]')?.value;
    const to = qs('[data-login-to]')?.value;
    if (status) {
        params.set('status', status);
    }
    if (from) {
        params.set('date_from', from);
    }
    if (to) {
        params.set('date_to', to);
    }
    return params.toString();
}

async function loadActivity() {
    if (activityState.loading) {
        return;
    }
    activityState.loading = true;
    activityTable.setLoading();
    try {
        const payload = await api.get(`/logs/activity?${activityQuery()}`);
        const rows = payload?.data || [];
        activityRows.clear();
        rows.forEach((row) => activityRows.set(String(row.id), row));
        activityTable.render(rows);
        if (activityTotal) {
            activityTotal.textContent = `${number(payload?.meta?.total ?? rows.length)} bản ghi`;
        }
        renderPagination(activityPagination, payload?.meta || {}, (page) => {
            activityState.page = page;
            loadActivity();
        });
    } catch (error) {
        activityTable.setError(error.message || 'Không tải được nhật ký hoạt động');
        showToast(error.message || 'Không tải được nhật ký hoạt động', 'danger');
    } finally {
        activityState.loading = false;
    }
}

async function loadLogins() {
    if (loginState.loading) {
        return;
    }
    loginState.loading = true;
    loginTable.setLoading();
    try {
        const payload = await api.get(`/logs/logins?${loginQuery()}`);
        const rows = payload?.data || [];
        loginRows.splice(0, loginRows.length, ...rows);
        loginTable.render(rows);
        if (loginTotal) {
            loginTotal.textContent = `${number(payload?.meta?.total ?? rows.length)} lượt`;
        }
        renderPagination(loginPagination, payload?.meta || {}, (page) => {
            loginState.page = page;
            loadLogins();
        });
        loginState.loaded = true;
    } catch (error) {
        loginTable.setError(error.message || 'Không tải được lịch sử đăng nhập');
        showToast(error.message || 'Không tải được lịch sử đăng nhập', 'danger');
    } finally {
        loginState.loading = false;
    }
}

function prettyJson(value) {
    if (!value) {
        return null;
    }
    try {
        return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
        return String(value);
    }
}

function openDetail(row) {
    const modal = createModal({
        title: 'Chi tiết nhật ký',
        size: 'lg',
        onHidden: () => window.setTimeout(() => modal.destroy(), 150)
    });

    const action = ACTION_META[row.action] || { label: row.action || '—', tone: 'neutral' };
    const target = row.target_type
        ? `${row.target_type}${row.target_id ? ` #${row.target_id}` : ''}`
        : '—';
    const oldJson = prettyJson(row.old_values);
    const newJson = prettyJson(row.new_values);

    modal.setBody(`
        <dl class="info-list">
            <dt>Thời gian</dt><dd>${escapeHtml(datetime(row.created_at))}</dd>
            <dt>Người thực hiện</dt><dd>${escapeHtml(row.user_name || 'Hệ thống')}</dd>
            <dt>Thao tác</dt><dd><span class="hk-badge hk-badge--${action.tone}">${escapeHtml(action.label)}</span> · ${escapeHtml(MODULE_LABELS[row.module] || row.module || '—')}</dd>
            <dt>Nội dung</dt><dd>${escapeHtml(row.description || '—')}</dd>
            <dt>Đối tượng</dt><dd>${escapeHtml(target)}</dd>
            <dt>IP</dt><dd>${escapeHtml(row.ip_address || '—')}</dd>
            <dt>Thiết bị</dt><dd class="fs-13">${escapeHtml(row.user_agent || '—')}</dd>
        </dl>
        <div class="log-detail__section">
            <h3 class="log-detail__section-title">Giá trị trước</h3>
            ${oldJson
                ? `<pre class="log-json">${escapeHtml(oldJson)}</pre>`
                : '<pre class="log-json log-json--empty">Không có dữ liệu thay đổi</pre>'}
        </div>
        <div class="log-detail__section">
            <h3 class="log-detail__section-title">Giá trị sau</h3>
            ${newJson
                ? `<pre class="log-json">${escapeHtml(newJson)}</pre>`
                : '<pre class="log-json log-json--empty">Không có dữ liệu thay đổi</pre>'}
        </div>`);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn-hk-outline';
    close.dataset.bsDismiss = 'modal';
    close.textContent = 'Đóng';
    modal.setFooter([close]);
    modal.show();
}

function switchTab(tab) {
    document.querySelectorAll('[data-log-tab]').forEach((button) => {
        const active = button.dataset.logTab === tab;
        button.classList.toggle('btn-hk', active);
        button.classList.toggle('btn-hk-outline', !active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-log-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.logPanel !== tab;
    });
    if (tab === 'logins' && !loginState.loaded) {
        loadLogins();
    }
}

function openLoginDetail(row) {
    const modal = createModal({
        title: 'Chi tiết đăng nhập',
        size: 'sm',
        onHidden: () => window.setTimeout(() => modal.destroy(), 150)
    });
    modal.setBody(`
        <dl class="info-list">
            <dt>Thời gian</dt><dd>${escapeHtml(datetime(row.created_at))}</dd>
            <dt>Người dùng</dt><dd>${escapeHtml(row.user_name || row.attempted_identifier || 'Không xác định')}</dd>
            <dt>Tài khoản nhập</dt><dd>${escapeHtml(row.attempted_identifier || '—')}</dd>
            <dt>Phương thức</dt><dd>${escapeHtml(labels.loginMethod(row.login_method))}</dd>
            <dt>Kết quả</dt><dd>${row.status === 'success' ? '<span class="hk-badge hk-badge--success">Thành công</span>' : '<span class="hk-badge hk-badge--danger">Thất bại</span>'}</dd>
            <dt>IP</dt><dd>${escapeHtml(row.ip_address || '—')}</dd>
            <dt>Thiết bị</dt><dd class="fs-13">${escapeHtml(row.user_agent || '—')}</dd>
        </dl>`);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn-hk-outline btn-sm';
    close.dataset.bsDismiss = 'modal';
    close.textContent = 'Đóng';
    modal.setFooter([close]);
    modal.show();
}

qs('[data-login-table]')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-login-detail]');
    if (!btn) return;
    const row = loginRows[Number(btn.dataset.loginDetail)];
    if (row) {
        openLoginDetail(row);
    }
});

qs('[data-activity-table]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="detail"]');
    if (!button) {
        return;
    }
    const row = activityRows.get(String(button.dataset.id));
    if (row) {
        openDetail(row);
    }
});

document.querySelectorAll('[data-log-tab]').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.logTab));
});

for (const [selector, loader] of [
    ['[data-activity-module]', 'activity'],
    ['[data-activity-from]', 'activity'],
    ['[data-activity-to]', 'activity'],
    ['[data-login-status]', 'logins'],
    ['[data-login-from]', 'logins'],
    ['[data-login-to]', 'logins']
]) {
    qs(selector)?.addEventListener('change', () => {
        if (loader === 'activity') {
            activityState.page = 1;
            loadActivity();
        } else {
            loginState.page = 1;
            loadLogins();
        }
    });
}

document.addEventListener('hk:toolbar-submit', (event) => {
    const form = event.detail?.form;
    if (!form) {
        return;
    }
    event.preventDefault();
    if (form.closest('[data-log-panel="activity"]')) {
        activityState.page = 1;
        loadActivity();
    } else if (form.closest('[data-log-panel="logins"]')) {
        loginState.page = 1;
        loadLogins();
    }
});

document.addEventListener('hk:ready', () => {
    loadActivity();
});
