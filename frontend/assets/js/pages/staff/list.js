import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { renderPagination } from '../../../../components/pagination/pagination.js';
import { confirmAction, createModal, showFormErrors } from '../../../../components/modal/modal.js';
import { can, session } from '../../core/auth.js';
import { datetime, initials, statusMeta } from '../../core/format.js';
import { escapeHtml, qs, setLoading } from '../../core/dom.js';
import { fileUrl } from '../../core/config.js';

const state = {
    page: 1,
    q: '',
    role: '',
    status: '',
    rows: [],
    loading: false
};

const table = createTable(qs('[data-staff-table]'), {
    emptyTitle: 'Chưa có nhân viên',
    emptyHint: 'Thêm tài khoản nhân viên để bắt đầu phân công công việc.',
    emptyIcon: 'bi-person-badge',
    columns: [
        {
            label: 'Nhân viên',
            render: (row) => `
                <div class="staff-cell">
                    <span class="hk-avatar hk-avatar--sm hk-desktop-only${row.avatar_path ? '' : ' hk-avatar--fallback'}">
                        ${row.avatar_path
                            ? `<img src="${escapeHtml(fileUrl(row.avatar_path))}" alt="${escapeHtml(row.full_name)}">`
                            : escapeHtml(initials(row.full_name))}
                    </span>
                    <span class="min-w-0">
                        <span class="staff-cell__name">${escapeHtml(row.full_name)}</span>
                        <span class="staff-cell__username">@${escapeHtml(row.username)}<span class="hk-mobile-only"> · ${escapeHtml(row.role_name || row.role_key)}</span></span>
                    </span>
                </div>`
        },
        { label: 'Vai trò', mobileHide: true, render: (row) => escapeHtml(row.role_name || row.role_key) },
        { label: 'Cơ sở', mobileHide: true, render: (row) => `<span class="staff-branches">${escapeHtml(row.branch_names || 'Chưa phân công')}</span>` },
        {
            label: 'Liên hệ',
            mobileHide: true,
            render: (row) => {
                const parts = [];
                if (row.email) parts.push(`<span class="d-block fs-13">${escapeHtml(row.email)}</span>`);
                if (row.phone) parts.push(`<span class="fs-13 text-muted-2">${escapeHtml(row.phone)}</span>`);
                return parts.length ? parts.join('') : '<span class="text-muted-2">—</span>';
            }
        },
        {
            label: 'Trạng thái',
            render: (row) => {
                const meta = statusMeta('user', row.status);
                return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
            }
        },
        { label: 'Đăng nhập cuối', mobileHide: true, render: (row) => `<span class="fs-13">${escapeHtml(datetime(row.last_login_at))}</span>` },
        {
            label: 'Thao tác',
            headerClass: 'text-end',
            className: 'text-end',
            render: (row, index) => {
                const actions = [
                    `<button type="button" class="btn btn-sm btn-light hk-mobile-only" data-action="detail" data-index="${index}">Chi tiết</button>`
                ];
                if (can('staff.manage')) {
                    actions.push(`<a class="btn btn-sm btn-light hk-desktop-only" href="../form/?id=${row.id}" title="Chỉnh sửa"><i class="bi bi-pencil"></i></a>`);
                    actions.push(`<button type="button" class="btn btn-sm btn-light hk-desktop-only" data-action="reset" data-id="${row.id}" data-name="${escapeHtml(row.full_name)}" title="Đặt lại mật khẩu"><i class="bi bi-key"></i></button>`);
                    if (Number(row.id) !== Number(session.user?.id)) {
                        actions.push(row.status === 'locked'
                            ? `<button type="button" class="btn btn-sm btn-light text-success hk-desktop-only" data-action="unlock" data-id="${row.id}" data-name="${escapeHtml(row.full_name)}" title="Mở khoá"><i class="bi bi-unlock"></i></button>`
                            : `<button type="button" class="btn btn-sm btn-light text-danger hk-desktop-only" data-action="lock" data-id="${row.id}" data-name="${escapeHtml(row.full_name)}" title="Khoá tài khoản"><i class="bi bi-lock"></i></button>`);
                    }
                }
                return `<div class="staff-actions">${actions.join('')}</div>`;
            }
        }
    ]
});

async function load() {
    if (state.loading) {
        return;
    }
    state.loading = true;
    table.setLoading();
    try {
        const payload = await api.get('/staff', {
            page: state.page,
            q: state.q,
            role_key: state.role,
            status: state.status
        });
        state.rows = payload?.data || [];
        table.render(state.rows);
        renderPagination(qs('[data-staff-pagination]'), payload?.meta || {}, (page) => {
            state.page = page;
            load();
        });
    } catch (error) {
        table.setError(error.message || 'Không tải được danh sách nhân viên');
        showToast(error.message || 'Không tải được danh sách nhân viên', 'danger');
    } finally {
        state.loading = false;
    }
}

function openResetModal(staffId, staffName) {
    const modal = createModal({ title: 'Đặt lại mật khẩu', size: 'sm' });
    const form = document.createElement('form');
    form.innerHTML = `
        <p class="fs-13 text-muted-2">Đặt mật khẩu mới cho <strong>${escapeHtml(staffName)}</strong>.</p>
        <div class="mb-3">
            <label class="form-label" for="reset-password">Mật khẩu mới <span class="text-danger">*</span></label>
            <input class="form-control" id="reset-password" name="new_password" type="password"
                   minlength="10" maxlength="255" required autocomplete="new-password">
            <div class="form-hint">Tối thiểu 10 ký tự, gồm chữ và số.</div>
        </div>
        <div class="mb-3">
            <label class="form-label" for="reset-password-confirm">Nhập lại mật khẩu <span class="text-danger">*</span></label>
            <input class="form-control" id="reset-password-confirm" type="password" minlength="10" required>
        </div>`;
    modal.setBody(form);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-hk-outline';
    cancel.textContent = 'Huỷ';
    cancel.dataset.bsDismiss = 'modal';

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn-hk';
    submit.textContent = 'Đặt lại mật khẩu';
    submit.addEventListener('click', async () => {
        if (!form.reportValidity()) {
            return;
        }
        const password = form.querySelector('#reset-password').value;
        const confirm = form.querySelector('#reset-password-confirm').value;
        if (password !== confirm) {
            showToast('Mật khẩu nhập lại không khớp', 'warning');
            return;
        }
        if (password.length < 10 || !/\p{L}/u.test(password) || !/\p{N}/u.test(password)) {
            showToast('Mật khẩu tối thiểu 10 ký tự, gồm chữ và số', 'warning');
            return;
        }
        setLoading(submit, true, 'Đang cập nhật...');
        try {
            await api.post(`/staff/${staffId}/reset-password`, { new_password: password });
            modal.hide();
            showToast('Đã đặt lại mật khẩu nhân viên', 'success');
        } catch (error) {
            if (error.status === 422 && error.errors) {
                showFormErrors(form, error.errors);
            }
            showToast(error.message || 'Không đặt lại được mật khẩu', 'danger');
        } finally {
            setLoading(submit, false);
        }
    });

    modal.setFooter([cancel, submit]);
    modal.show();
}

function openStaffDetail(row) {
    const meta = statusMeta('user', row.status);
    const modal = createModal({ title: row.full_name || 'Chi tiết nhân viên', size: 'sm' });
    const body = document.createElement('dl');
    body.className = 'info-list';
    body.innerHTML = `
        <dt>Tên đăng nhập</dt><dd>@${escapeHtml(row.username || '—')}</dd>
        <dt>Vai trò</dt><dd>${escapeHtml(row.role_name || row.role_key || '—')}</dd>
        <dt>Cơ sở</dt><dd>${escapeHtml(row.branch_names || 'Chưa phân công')}</dd>
        <dt>Email</dt><dd>${escapeHtml(row.email || '—')}</dd>
        <dt>Điện thoại</dt><dd>${escapeHtml(row.phone || '—')}</dd>
        <dt>Trạng thái</dt><dd><span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span></dd>
        <dt>Đăng nhập cuối</dt><dd>${escapeHtml(datetime(row.last_login_at))}</dd>`;
    modal.setBody(body);

    const footer = [];
    if (can('staff.manage')) {
        const editLink = document.createElement('a');
        editLink.className = 'btn-hk-outline btn-sm';
        editLink.href = `../form/?id=${row.id}`;
        editLink.innerHTML = '<i class="bi bi-pencil me-1"></i>Sửa';
        footer.push(editLink);

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'btn-hk-outline btn-sm';
        resetBtn.innerHTML = '<i class="bi bi-key me-1"></i>Đổi MK';
        resetBtn.addEventListener('click', () => {
            modal.hide();
            openResetModal(Number(row.id), row.full_name || '');
        });
        footer.push(resetBtn);
    }
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-hk btn-sm';
    closeBtn.textContent = 'Đóng';
    closeBtn.dataset.bsDismiss = 'modal';
    footer.push(closeBtn);
    modal.setFooter(footer);
    modal.show();
}

qs('[data-staff-table]')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) {
        return;
    }
    if (button.dataset.action === 'detail') {
        const row = state.rows[Number(button.dataset.index)];
        if (row) {
            openStaffDetail(row);
        }
        return;
    }
    const id = Number(button.dataset.id);
    const name = button.dataset.name || '';
    if (button.dataset.action === 'reset') {
        openResetModal(id, name);
        return;
    }
    const locking = button.dataset.action === 'lock';
    const confirmed = await confirmAction({
        title: locking ? 'Khoá tài khoản' : 'Mở khoá tài khoản',
        message: locking
            ? `Khoá tài khoản "${name}"? Nhân viên sẽ không đăng nhập được.`
            : `Mở khoá tài khoản "${name}"?`,
        tone: locking ? 'danger' : 'warning',
        confirmText: locking ? 'Khoá tài khoản' : 'Mở khoá'
    });
    if (!confirmed) {
        return;
    }
    try {
        await api.post(`/staff/${id}/${locking ? 'lock' : 'unlock'}`);
        showToast(locking ? 'Đã khoá tài khoản' : 'Đã mở khoá tài khoản', 'success');
        load();
    } catch (error) {
        showToast(error.message || 'Không đổi được trạng thái tài khoản', 'danger');
    }
});

document.addEventListener('hk:toolbar-search', (event) => {
    state.q = event.detail?.value || '';
    state.page = 1;
    load();
});

document.addEventListener('hk:toolbar-submit', (event) => {
    event.preventDefault();
});

document.addEventListener('hk:ready', () => {
    qs('[data-role]')?.addEventListener('change', (event) => {
        state.role = event.target.value;
        state.page = 1;
        load();
    });
    qs('[data-status]')?.addEventListener('change', (event) => {
        state.status = event.target.value;
        state.page = 1;
        load();
    });
    load();
});
