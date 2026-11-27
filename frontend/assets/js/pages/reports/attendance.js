import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { can } from '../../core/auth.js';
import { date, datetime, number, statusMeta, todayIso } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

const today = todayIso();
const monthStart = `${today.slice(0, 8)}01`;

const state = {
    classId: '',
    dateFrom: monthStart,
    dateTo: today,
    loading: false
};

const table = createTable(qs('[data-report-table]'), {
    emptyTitle: 'Chưa có dữ liệu',
    emptyHint: 'Chưa có lượt điểm danh phù hợp với bộ lọc hiện tại.',
    emptyIcon: 'bi-calendar2-check',
    columns: [
        {
            label: 'Ngày',
            render: (row) => `${escapeHtml(date(row.session_date))}
                <span class="cell-meta">${escapeHtml(row.slot_name || '')}</span>`
        },
        {
            label: 'Lớp',
            render: (row) => row.class_name
                ? escapeHtml(row.class_name)
                : '<span class="text-muted-2">Chưa xếp lớp</span>'
        },
        {
            label: 'Học viên',
            render: (row) => `<span class="cell-title">${escapeHtml(row.full_name)}</span>
                <span class="cell-meta">${escapeHtml(row.student_code)}</span>`
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
            render: (row) => row.note
                ? `<span class="cell-meta">${escapeHtml(row.note)}</span>`
                : '<span class="text-muted-2">—</span>'
        },
        { label: 'Người ghi', render: (row) => escapeHtml(row.recorded_by_name || '—') },
        { label: 'Ghi lúc', render: (row) => escapeHtml(datetime(row.recorded_at)) }
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

document.addEventListener('hk:ready', () => {
    bindFilters();
    loadClasses();
    load();
});
