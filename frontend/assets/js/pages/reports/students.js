import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { createModal } from '../../../../components/modal/modal.js';
import { can, currentBranch } from '../../core/auth.js';
import { date, labels, money, number, statusMeta } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

const state = {
    q: '',
    status: '',
    classId: '',
    rows: [],
    loading: false
};

const table = createTable(qs('[data-report-table]'), {
    emptyTitle: 'Chưa có dữ liệu',
    emptyHint: 'Chưa có học viên phù hợp với bộ lọc hiện tại.',
    emptyIcon: 'bi-people',
    columns: [
        {
            label: 'Học viên',
            render: (row) => `
                <span class="cell-title">${escapeHtml(row.full_name)}</span>
                <span class="cell-meta">${escapeHtml(row.class_name || 'Chưa xếp lớp')}<span class="hk-desktop-only"> · ${escapeHtml(row.student_code)}</span></span>`
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
                return `<span class="cell-title">${escapeHtml(row.guardian_name || '—')}</span>
                    <span class="cell-meta">${escapeHtml(row.guardian_phone || '')}</span>`;
            }
        },
        {
            label: 'Ngày sinh',
            mobileHide: true,
            render: (row) => `${escapeHtml(date(row.dob))}
                <span class="cell-meta">${escapeHtml(labels.gender(row.gender))}</span>`
        },
        {
            label: 'Địa chỉ',
            mobileHide: true,
            render: (row) => row.address
                ? `<span class="cell-meta">${escapeHtml(row.address)}</span>`
                : '<span class="text-muted-2">—</span>'
        },
        { label: 'Học phí', mobileHide: true, className: 'text-end', render: (row) => escapeHtml(money(row.monthly_fee)) },
        { label: 'Ngày vào', mobileHide: true, render: (row) => escapeHtml(date(row.enrollment_date)) },
        {
            label: 'Trạng thái',
            render: (row) => {
                const meta = statusMeta('student', row.status);
                const title = row.status === 'left' && row.left_at ? ` title="Nghỉ từ ${escapeHtml(date(row.left_at))}"` : '';
                return `<span class="hk-badge hk-badge--${meta.tone}"${title}>${escapeHtml(meta.label)}</span>`;
            }
        },
        {
            label: '',
            headerClass: 'text-end hk-col-mobile-only',
            className: 'text-end hk-col-mobile-only',
            render: (_row, index) => `<button type="button" class="btn btn-sm btn-light" data-report-detail="${index}">Chi tiết</button>`
        }
    ]
});

const totalChip = qs('[data-report-total]');
const scopeChip = qs('[data-report-scope]');
const classSelect = qs('[data-report-class]');
const classWrap = qs('[data-class-filter]');

function buildQuery() {
    const params = new URLSearchParams();
    if (state.q) {
        params.set('q', state.q);
    }
    if (state.status) {
        params.set('status', state.status);
    }
    if (state.classId) {
        params.set('class_id', state.classId);
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
        const payload = await api.get(`/reports/students?${buildQuery()}`);
        const rows = payload?.data || [];
        state.rows = rows;
        table.render(rows);
        if (totalChip) {
            totalChip.textContent = `${number(payload?.meta?.total ?? rows.length)} học viên`;
        }
    } catch (error) {
        table.setError(error.message || 'Không tải được báo cáo học viên');
        showToast(error.message || 'Không tải được báo cáo học viên', 'danger');
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
        classSelect.insertAdjacentHTML('beforeend', classes.map((item) =>
            `<option value="${item.id}">${escapeHtml(item.name)}${item.status === 'inactive' ? ' (ngừng)' : ''}</option>`
        ).join(''));
        classWrap.hidden = classes.length === 0;
    } catch {
        classWrap.hidden = true;
    }
}

function bindToolbar() {
    qs('[data-report-status]')?.addEventListener('change', (event) => {
        state.status = event.target.value;
        load();
    });
    classSelect?.addEventListener('change', (event) => {
        state.classId = event.target.value;
        load();
    });
    document.addEventListener('hk:toolbar-search', (event) => {
        state.q = event.detail?.value || '';
        load();
    });
    document.addEventListener('hk:toolbar-submit', (event) => {
        event.preventDefault();
    });
}

function openStudentReportDetail(row) {
    const meta = statusMeta('student', row.status);
    const modal = createModal({ title: row.full_name || 'Chi tiết học viên', size: 'sm' });
    const body = document.createElement('dl');
    body.className = 'info-list';
    body.innerHTML = `
        <dt>Mã học viên</dt><dd>${escapeHtml(row.student_code || '—')}</dd>
        <dt>Lớp</dt><dd>${escapeHtml(row.class_name || 'Chưa xếp lớp')}</dd>
        <dt>Ngày sinh</dt><dd>${escapeHtml(date(row.dob))} (${escapeHtml(labels.gender(row.gender))})</dd>
        <dt>Phụ huynh</dt><dd>${escapeHtml(row.guardian_name || '—')}</dd>
        <dt>SĐT liên hệ</dt><dd>${escapeHtml(row.guardian_phone || '—')}</dd>
        <dt>Địa chỉ</dt><dd>${escapeHtml(row.address || '—')}</dd>
        <dt>Học phí</dt><dd>${escapeHtml(money(row.monthly_fee))}</dd>
        <dt>Ngày nhập học</dt><dd>${escapeHtml(date(row.enrollment_date))}</dd>
        <dt>Trạng thái</dt><dd><span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span></dd>`;
    modal.setBody(body);

    const footer = [];
    if (row.id) {
        const profileLink = document.createElement('a');
        profileLink.className = 'btn-hk-outline btn-sm';
        profileLink.href = `../../students/detail/?id=${row.id}`;
        profileLink.innerHTML = '<i class="bi bi-person-vcard me-1"></i>Mở hồ sơ';
        footer.push(profileLink);
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

document.addEventListener('hk:ready', () => {
    qs('[data-report-table]')?.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-report-detail]');
        if (!btn) return;
        const row = state.rows[Number(btn.dataset.reportDetail)];
        if (row) {
            openStudentReportDetail(row);
        }
    });

    const branch = currentBranch();
    if (scopeChip) {
        scopeChip.textContent = branch ? branch.name : 'Toàn hệ thống';
    }
    bindToolbar();
    loadClasses();
    load();
});
