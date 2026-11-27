import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { renderPagination } from '../../../../components/pagination/pagination.js';
import { confirmAction } from '../../../../components/modal/modal.js';
import { can } from '../../core/auth.js';
import { date, initials, money, statusMeta } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';
import { fileUrl } from '../../core/config.js';

const state = {
    page: 1,
    q: '',
    status: '',
    classId: '',
    includeDeleted: false,
    loading: false
};

const table = createTable(qs('[data-students-table]'), {
    emptyTitle: 'Chưa có học viên',
    emptyHint: 'Thêm hồ sơ học viên đầu tiên hoặc thay đổi bộ lọc.',
    emptyIcon: 'bi-people',
    columns: [
        {
            label: 'Học viên',
            render: (row) => `
                <a class="student-cell" href="../detail/?id=${row.id}">
                    <span class="hk-avatar hk-avatar--sm hk-desktop-only${row.avatar_path ? '' : ' hk-avatar--fallback'}">
                        ${row.avatar_path
                            ? `<img src="${escapeHtml(fileUrl(row.avatar_path))}" alt="${escapeHtml(row.full_name)}">`
                            : escapeHtml(initials(row.full_name))}
                    </span>
                    <span class="min-w-0">
                        <span class="student-cell__name">${escapeHtml(row.full_name)}</span>
                        <span class="student-cell__meta">${escapeHtml(row.class_name || 'Chưa xếp lớp')}<span class="hk-desktop-only"> · ${escapeHtml(row.student_code)}</span></span>
                    </span>
                </a>`
        },
        {
            label: 'Lớp',
            mobileHide: true,
            render: (row) => row.class_name
                ? escapeHtml(row.class_name)
                : '<span class="text-muted-2">Chưa xếp lớp</span>'
        },
        {
            label: 'Phụ huynh',
            mobileHide: true,
            render: (row) => {
                if (!row.guardian_name && !row.guardian_phone) {
                    return '<span class="text-muted-2">—</span>';
                }
                return `<span class="d-block">${escapeHtml(row.guardian_name || '—')}</span>
                    <span class="student-cell__meta">${escapeHtml(row.guardian_phone || '')}</span>`;
            }
        },
        { label: 'Ngày sinh', mobileHide: true, render: (row) => escapeHtml(date(row.dob)) },
        { label: 'Học phí', mobileHide: true, className: 'text-end', render: (row) => escapeHtml(money(row.monthly_fee)) },
        {
            label: 'Trạng thái',
            render: (row) => {
                if (row.deleted_at) {
                    return '<span class="hk-badge hk-badge--danger">Đã xoá</span>';
                }
                const meta = statusMeta('student', row.status);
                return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
            }
        },
        {
            label: 'Thao tác',
            headerClass: 'text-end',
            render: (row) => {
                const actions = [
                    `<a class="btn btn-sm btn-light" href="../detail/?id=${row.id}" title="Xem hồ sơ"><i class="bi bi-eye"></i><span class="hk-mobile-only ms-1">Chi tiết</span></a>`
                ];
                if (row.deleted_at) {
                    if (can('students.restore')) {
                        actions.push(`<button type="button" class="btn btn-sm btn-light text-success hk-desktop-only" data-action="restore" data-id="${row.id}" title="Khôi phục"><i class="bi bi-arrow-counterclockwise"></i></button>`);
                    }
                } else {
                    actions.push(`<a class="btn btn-sm btn-light hk-desktop-only" href="../slip/?id=${row.id}" title="Phiếu thống kê gửi phụ huynh"><i class="bi bi-file-earmark-image"></i></a>`);
                    if (can('students.update')) {
                        actions.push(`<a class="btn btn-sm btn-light hk-desktop-only" href="../form/?id=${row.id}" title="Chỉnh sửa"><i class="bi bi-pencil"></i></a>`);
                    }
                    if (can('students.delete')) {
                        actions.push(`<button type="button" class="btn btn-sm btn-light text-danger hk-desktop-only" data-action="delete" data-id="${row.id}" data-name="${escapeHtml(row.full_name)}" title="Xoá"><i class="bi bi-trash3"></i></button>`);
                    }
                }
                return `<div class="student-actions">${actions.join('')}</div>`;
            }
        }
    ],
    rowClass: (row) => (row.deleted_at ? 'student-row--deleted' : '')
});

const paginationBox = qs('[data-students-pagination]');
const classSelect = qs('[data-filter-class]');
const classWrap = qs('[data-class-filter]');

function buildQuery() {
    const params = new URLSearchParams();
    params.set('page', String(state.page));
    if (state.q) {
        params.set('q', state.q);
    }
    if (state.status) {
        params.set('status', state.status);
    }
    if (state.classId) {
        params.set('class_id', state.classId);
    }
    if (state.includeDeleted) {
        params.set('include_deleted', '1');
    }
    return params.toString();
}

async function load() {
    if (state.loading) {
        return;
    }
    state.loading = true;
    table.setLoading();
    try {
        const payload = await api.get(`/students?${buildQuery()}`);
        table.render(payload?.data || []);
        renderPagination(paginationBox, payload?.meta || {}, (page) => {
            state.page = page;
            load();
        });
    } catch (error) {
        table.setError(error.message || 'Không tải được danh sách học viên');
        showToast(error.message || 'Không tải được danh sách học viên', 'danger');
    } finally {
        state.loading = false;
    }
}

async function loadClasses() {
    if (!can('classes.view') || !classSelect) {
        return;
    }
    try {
        const payload = await api.get('/classes');
        const classes = payload?.data || [];
        if (!classes.length) {
            return;
        }
        classSelect.insertAdjacentHTML('beforeend', classes.map((item) =>
            `<option value="${item.id}">${escapeHtml(item.name)}${item.status === 'inactive' ? ' (ngừng)' : ''}</option>`
        ).join(''));
        classWrap.hidden = false;
    } catch {
        classWrap.hidden = true;
    }
}

function bindToolbar() {
    qs('[data-filter-status]')?.addEventListener('change', (event) => {
        state.status = event.target.value;
        state.page = 1;
        load();
    });
    classSelect?.addEventListener('change', (event) => {
        state.classId = event.target.value;
        state.page = 1;
        load();
    });
    qs('[data-include-deleted]')?.addEventListener('change', (event) => {
        state.includeDeleted = event.target.checked;
        state.page = 1;
        load();
    });
    document.addEventListener('hk:toolbar-search', (event) => {
        state.q = event.detail?.value || '';
        state.page = 1;
        load();
    });
    document.addEventListener('hk:toolbar-submit', (event) => {
        event.preventDefault();
    });
}

qs('[data-students-table]')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) {
        return;
    }
    const id = Number(button.dataset.id);
    if (button.dataset.action === 'delete') {
        const confirmed = await confirmAction({
            title: 'Xoá học viên',
            message: `Xoá hồ sơ "${button.dataset.name}"? Học viên sẽ được ẩn khỏi danh sách nhưng vẫn có thể khôi phục.`,
            confirmText: 'Xoá học viên'
        });
        if (!confirmed) {
            return;
        }
        try {
            await api.delete(`/students/${id}`);
            showToast('Đã xoá học viên', 'success');
            load();
        } catch (error) {
            showToast(error.message || 'Không xoá được học viên', 'danger');
        }
    }
    if (button.dataset.action === 'restore') {
        const confirmed = await confirmAction({
            title: 'Khôi phục học viên',
            message: 'Khôi phục hồ sơ học viên này trở lại danh sách?',
            tone: 'warning',
            confirmText: 'Khôi phục'
        });
        if (!confirmed) {
            return;
        }
        try {
            await api.post(`/students/${id}/restore`);
            showToast('Đã khôi phục học viên', 'success');
            load();
        } catch (error) {
            showToast(error.message || 'Không khôi phục được học viên', 'danger');
        }
    }
});

document.addEventListener('hk:ready', () => {
    bindToolbar();
    loadClasses();
    load();
});
