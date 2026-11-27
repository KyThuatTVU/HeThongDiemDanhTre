import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { renderPagination } from '../../../../components/pagination/pagination.js';
import { createModal } from '../../../../components/modal/modal.js';
import { can } from '../../core/auth.js';
import { date, datetime, number, statusMeta, weekdayLabel } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

const state = {
    page: 1,
    classId: '',
    dateFrom: '',
    dateTo: '',
    rows: [],
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
            mobileHide: true,
            render: (row) => `<span class="d-block">${escapeHtml(date(row.session_date))}</span>
                <span class="fs-13 text-muted-2">${escapeHtml(weekdayLabel(row.session_date))}</span>`
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
            render: (row) => `<span class="d-block fw-semibold">${escapeHtml(row.full_name)}</span>
                <span class="fs-13 text-muted-2"><span class="hk-mobile-only">${escapeHtml(date(row.session_date))} · </span>${escapeHtml(row.class_name || row.student_code)}</span>`
        },
        {
            label: 'Trạng thái',
            render: (row) => {
                const meta = statusMeta('attendance', row.status);
                return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
            }
        },
        { label: 'Ghi chú', mobileHide: true, render: (row) => escapeHtml(row.note || '—') },
        { label: 'Người ghi', mobileHide: true, render: (row) => escapeHtml(row.recorded_by_name || '—') },
        { label: 'Ghi lúc', mobileHide: true, render: (row) => `<span class="fs-13">${escapeHtml(datetime(row.recorded_at))}</span>` },
        {
            label: '',
            headerClass: 'text-end hk-col-mobile-only',
            className: 'text-end hk-col-mobile-only',
            render: (_row, index) => `<button type="button" class="btn btn-sm btn-light" data-history-detail="${index}" title="Xem chi tiết">Chi tiết</button>`
        }
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
        state.rows = payload?.data || [];
        table.render(state.rows);
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

function openHistoryDetail(row) {
    const meta = statusMeta('attendance', row.status);
    const modal = createModal({ title: row.full_name || 'Chi tiết điểm danh', size: 'sm' });
    const body = document.createElement('dl');
    body.className = 'info-list';
    body.innerHTML = `
        <dt>Mã học viên</dt><dd>${escapeHtml(row.student_code || '—')}</dd>
        <dt>Ngày học</dt><dd>${escapeHtml(date(row.session_date))} (${escapeHtml(weekdayLabel(row.session_date))})</dd>
        <dt>Lớp</dt><dd>${escapeHtml(row.class_name || 'Chưa xếp lớp')}</dd>
        <dt>Trạng thái</dt><dd><span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span></dd>
        <dt>Ghi chú</dt><dd>${escapeHtml(row.note || 'Không có')}</dd>
        <dt>Người ghi</dt><dd>${escapeHtml(row.recorded_by_name || '—')}</dd>
        <dt>Ghi lúc</dt><dd>${escapeHtml(datetime(row.recorded_at))}</dd>`;
    modal.setBody(body);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-hk-outline';
    closeBtn.textContent = 'Đóng';
    closeBtn.dataset.bsDismiss = 'modal';
    modal.setFooter([closeBtn]);
    modal.show();
}

document.addEventListener('hk:ready', () => {
    qs('[data-history-table]')?.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-history-detail]');
        if (!btn) return;
        const row = state.rows[Number(btn.dataset.historyDetail)];
        if (row) {
            openHistoryDetail(row);
        }
    });

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
