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
                    <span class="hk-avatar hk-avatar--sm${row.avatar_path ? '' : ' hk-avatar--fallback'}">
                        ${row.avatar_path
                            ? `<img src="${escapeHtml(fileUrl(row.avatar_path))}" alt="${escapeHtml(row.full_name)}">`
                            : escapeHtml(initials(row.full_name))}
                    </span>
                    <span>
                        <span class="staff-cell__name">${escapeHtml(row.full_name)}</span>
                        <span class="staff-cell__username">@${escapeHtml(row.username)}</span>
                    </span>
                </div>`
        },
        { label: 'Vai trò', render: (row) => escapeHtml(row.role_name || row.role_key) },
        { label: 'Cơ sở', render: (row) => `<span class="staff-branches">${escapeHtml(row.branch_names || 'Chưa phân công')}</span>` },
        {
            label: 'Liên hệ',
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
        { label: 'Đăng nhập cuối', render: (row) => `<span class="fs-13">${escapeHtml(datetime(row.last_login_at))}</span>` },
        {
            label: 'Thao tác',
            headerClass: 'text-end',
            render: (row) => {
                const actions = [];
                if (can('staff.manage')) {
                    actions.push(`<a class="btn btn-sm btn-light" href="../form/?id=${row.id}" title="Chỉnh sửa"><i class="bi bi-pencil"></i></a>`);
                    actions.push(`<button type="button" class="btn btn-sm btn-light" data-action="reset" data-id="${row.id}" data-name="${escapeHtml(row.full_name)}" title="Đặt lại mật khẩu"><i class="bi bi-key"></i></button>`);
                    if (Number(row.id) !== Number(session.user?.id)) {
                        actions.push(row.status === 'locked'
                            ? `<button type="button" class="btn btn-sm btn-light text-success" data-action="unlock" data-id="${row.id}" data-name="${escapeHtml(row.full_name)}" title="Mở khoá"><i class="bi bi-unlock"></i></button>`
                            : `<button type="button" class="btn btn-sm btn-light text-danger" data-action="lock" data-id="${row.id}" data-name="${escapeHtml(row.full_name)}" title="Khoá tài khoản"><i class="bi bi-lock"></i></button>`);
                    }
                }
                return actions.length ? `<div class="staff-actions">${actions.join('')}</div>` : '<span class="text-muted-2">—</span>';
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
        table.render(payload?.data || []);
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
                   minlength="8" maxlength="255" required autocomplete="new-password">
        </div>
        <div class="mb-3">
            <label class="form-label" for="reset-password-confirm">Nhập lại mật khẩu <span class="text-danger">*</span></label>
            <input class="form-control" id="reset-password-confirm" type="password" minlength="8" required>
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

qs('[data-staff-table]')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) {
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
