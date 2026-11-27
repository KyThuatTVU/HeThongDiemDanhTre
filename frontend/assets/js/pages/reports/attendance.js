import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { createModal } from '../../../../components/modal/modal.js';
import { can } from '../../core/auth.js';
import { date, datetime, number, statusMeta, todayIso } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

const today = todayIso();
const monthStart = `${today.slice(0, 8)}01`;

const state = {
    classId: '',
    dateFrom: monthStart,
    dateTo: today,
    rows: [],
    loading: false
};

const table = createTable(qs('[data-report-table]'), {
    emptyTitle: 'Chưa có dữ liệu',
    emptyHint: 'Chưa có lượt điểm danh phù hợp với bộ lọc hiện tại.',
    emptyIcon: 'bi-calendar2-check',
    columns: [
        {
            label: 'Ngày',
            mobileHide: true,
            render: (row) => `${escapeHtml(date(row.session_date))}
                <span class="cell-meta">${escapeHtml(row.slot_name || '')}</span>`
        },
        {
            label: 'Lớp',
            mobileHide: true,
            render: (row) => row.class_name
                ? escapeHtml(row.class_name)
                : '<span class="text-muted-2">Chưa xếp lớp</span>'
        },
        {
            label: 'Học viên',
            render: (row) => `<span class="cell-title">${escapeHtml(row.full_name)}</span>
                <span class="cell-meta"><span class="hk-mobile-only">${escapeHtml(date(row.session_date))} · </span>${escapeHtml(row.class_name || row.student_code)}</span>`
        },
        {
            label: 'Trạng thái',
            render: (row) => {
                const meta = statusMeta('attendance', row.status);
                return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
            }
        },
        {
            label: 'Ghi chú',
            mobileHide: true,
            render: (row) => row.note
                ? `<span class="cell-meta">${escapeHtml(row.note)}</span>`
                : '<span class="text-muted-2">—</span>'
        },
        { label: 'Người ghi', mobileHide: true, render: (row) => escapeHtml(row.recorded_by_name || '—') },
        { label: 'Ghi lúc', mobileHide: true, render: (row) => escapeHtml(datetime(row.recorded_at)) },
        {
            label: '',
            headerClass: 'text-end hk-col-mobile-only',
            className: 'text-end hk-col-mobile-only',
            render: (_row, index) => `<button type="button" class="btn btn-sm btn-light" data-report-detail="${index}">Chi tiết</button>`
        }
    ]
});

const totalChip = qs('[data-report-total]');
const periodChip = qs('[data-report-period]');
const classSelect = qs('[data-report-class]');
const classWrap = qs('[data-class-filter]');
const fromInput = qs('[data-report-from]');
const toInput = qs('[data-report-to]');

function renderPeriod() {
    if (periodChip) {
        periodChip.textContent = `${date(state.dateFrom)} → ${date(state.dateTo)}`;
    }
}

async function load() {
    if (state.loading) {
        return;
    }
    if (state.dateFrom && state.dateTo && state.dateFrom > state.dateTo) {
        showToast('"Từ ngày" phải trước hoặc bằng "Đến ngày"', 'warning');
        return;
    }
    state.loading = true;
    table.setLoading();
    try {
        const params = new URLSearchParams();
        if (state.classId) {
            params.set('class_id', state.classId);
        }
        if (state.dateFrom) {
            params.set('date_from', state.dateFrom);
        }
        if (state.dateTo) {
            params.set('date_to', state.dateTo);
        }
        const payload = await api.get(`/reports/attendance?${params.toString()}`);
        const rows = payload?.data || [];
        state.rows = rows;
        table.render(rows);
        if (totalChip) {
            totalChip.textContent = `${number(payload?.meta?.total ?? rows.length)} lượt`;
        }
        renderPeriod();
    } catch (error) {
        table.setError(error.message || 'Không tải được báo cáo điểm danh');
        showToast(error.message || 'Không tải được báo cáo điểm danh', 'danger');
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

function bindFilters() {
    fromInput.value = state.dateFrom;
    toInput.value = state.dateTo;
    classSelect?.addEventListener('change', (event) => {
        state.classId = event.target.value;
        load();
    });
    fromInput?.addEventListener('change', (event) => {
        state.dateFrom = event.target.value;
        load();
    });
    toInput?.addEventListener('change', (event) => {
        state.dateTo = event.target.value;
        load();
    });
    document.addEventListener('hk:toolbar-submit', (event) => {
        event.preventDefault();
        load();
    });
}

function openAttendanceReportDetail(row) {
    const meta = statusMeta('attendance', row.status);
    const modal = createModal({ title: row.full_name || 'Chi tiết điểm danh', size: 'sm' });
    const body = document.createElement('dl');
    body.className = 'info-list';
    body.innerHTML = `
        <dt>Mã học viên</dt><dd>${escapeHtml(row.student_code || '—')}</dd>
        <dt>Ngày học</dt><dd>${escapeHtml(date(row.session_date))}${row.slot_name ? ` (${escapeHtml(row.slot_name)})` : ''}</dd>
        <dt>Lớp</dt><dd>${escapeHtml(row.class_name || 'Chưa xếp lớp')}</dd>
        <dt>Trạng thái</dt><dd><span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span></dd>
        <dt>Ghi chú</dt><dd>${escapeHtml(row.note || 'Không có')}</dd>
        <dt>Người ghi</dt><dd>${escapeHtml(row.recorded_by_name || '—')}</dd>
        <dt>Ghi lúc</dt><dd>${escapeHtml(datetime(row.recorded_at))}</dd>`;
    modal.setBody(body);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-hk-outline btn-sm';
    closeBtn.textContent = 'Đóng';
    closeBtn.dataset.bsDismiss = 'modal';
    modal.setFooter([closeBtn]);
    modal.show();
}

document.addEventListener('hk:ready', () => {
    qs('[data-report-table]')?.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-report-detail]');
        if (!btn) return;
        const row = state.rows[Number(btn.dataset.reportDetail)];
        if (row) {
            openAttendanceReportDetail(row);
        }
    });

    bindFilters();
    loadClasses();
    load();
});
