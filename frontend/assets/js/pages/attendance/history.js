import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { renderPagination } from '../../../../components/pagination/pagination.js';
import { can } from '../../core/auth.js';
import { date, datetime, number, statusMeta, weekdayLabel } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

const state = {
    page: 1,
    classId: '',
    dateFrom: '',
    dateTo: '',
    loading: false
};

function monthRange() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (value) => {
        const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 10);
    };
    return [fmt(first), fmt(last)];
}

const [defaultFrom, defaultTo] = monthRange();
state.dateFrom = defaultFrom;
state.dateTo = defaultTo;

const table = createTable(qs('[data-history-table]'), {
    emptyTitle: 'Chưa có lượt điểm danh',
    emptyHint: 'Thử mở rộng khoảng ngày hoặc chọn lớp khác.',
    emptyIcon: 'bi-clock-history',
    columns: [
        {
            label: 'Ngày',
            render: (row) => `<span class="d-block">${escapeHtml(date(row.session_date))}</span>
                <span class="fs-13 text-muted-2">${escapeHtml(weekdayLabel(row.session_date))}</span>`
        },
        {
            label: 'Lớp',
            render: (row) => row.class_name
                ? escapeHtml(row.class_name)
                : '<span class="text-muted-2">Chưa xếp lớp</span>'
        },
        {
            label: 'Học viên',
            render: (row) => `<span class="d-block">${escapeHtml(row.full_name)}</span>
                <span class="fs-13 text-muted-2">${escapeHtml(row.student_code)}</span>`
        },
        {
            label: 'Trạng thái',
            render: (row) => {
                const meta = statusMeta('attendance', row.status);
                return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
            }
        },
        { label: 'Ghi chú', render: (row) => escapeHtml(row.note || '—') },
        { label: 'Người ghi', render: (row) => escapeHtml(row.recorded_by_name || '—') },
        { label: 'Ghi lúc', render: (row) => `<span class="fs-13">${escapeHtml(datetime(row.recorded_at))}</span>` }
    ]
});

const paginationBox = qs('[data-history-pagination]');

async function loadClasses() {
    if (!can('classes.view')) {
        return;
    }
    const select = qs('[data-history-class]');
    try {
        const payload = await api.get('/classes');
        (payload?.data || []).forEach((item) => {
            select.insertAdjacentHTML('beforeend',
                `<option value="${item.id}">${escapeHtml(item.name)}${item.status === 'inactive' ? ' (ngừng)' : ''}</option>`);
        });
        select.insertAdjacentHTML('beforeend', '<option value="unassigned">Chưa xếp lớp</option>');
    } catch {
        select.innerHTML = '<option value="">Tất cả lớp</option>';
    }
}

async function load() {
    if (state.loading) {
        return;
    }
    state.loading = true;
    table.setLoading();
    const query = {
        page: state.page,
        class_id: state.classId,
        date_from: state.dateFrom,
        date_to: state.dateTo
    };
    if (!query.class_id) {
        delete query.class_id;
    }
    try {
        const payload = await api.get('/attendance/history', query);
        table.render(payload?.data || []);
        renderPagination(paginationBox, payload?.meta || {}, (page) => {
            state.page = page;
            load();
        });
        const totalNode = qs('[data-history-total]');
        if (totalNode) {
            totalNode.textContent = `${number(payload?.meta?.total || 0)} lượt`;
        }
    } catch (error) {
        table.setError(error.message || 'Không tải được lịch sử điểm danh');
        showToast(error.message || 'Không tải được lịch sử điểm danh', 'danger');
    } finally {
        state.loading = false;
    }
}

function applyFilters(event) {
    if (event) {
        event.preventDefault();
    }
    const from = qs('[data-history-from]').value;
    const to = qs('[data-history-to]').value;
    if (from && to && from > to) {
        showToast('Từ ngày phải trước hoặc bằng đến ngày', 'warning');
        return;
    }
    state.classId = qs('[data-history-class]').value;
    state.dateFrom = from || defaultFrom;
    state.dateTo = to || defaultTo;
    state.page = 1;
    load();
}

document.addEventListener('hk:ready', () => {
    const fromInput = qs('[data-history-from]');
    const toInput = qs('[data-history-to]');
    fromInput.value = state.dateFrom;
    toInput.value = state.dateTo;

    qs('[data-history-filters]')?.addEventListener('submit', applyFilters);
    qs('[data-history-class]')?.addEventListener('change', () => {
        applyFilters();
    });

    loadClasses();
    load();
});
