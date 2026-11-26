import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { money, monthLabel, number, statusMeta } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

const now = new Date();
const state = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    status: '',
    q: '',
    loading: false
};

const table = createTable(qs('[data-report-table]'), {
    emptyTitle: 'Chưa có dữ liệu',
    emptyHint: 'Chưa có bảng học phí cho kỳ này. Hãy tạo bảng học phí trước.',
    emptyIcon: 'bi-cash-stack',
    columns: [
        {
            label: 'Học viên',
            render: (row) => `<span class="cell-title">${escapeHtml(row.student_name)}</span>
                <span class="cell-meta">${escapeHtml(row.student_code)}</span>`
        },
        { label: 'Lớp', render: (row) => escapeHtml(row.class_name || '—') },
        { label: 'Phải thu', className: 'text-end', render: (row) => escapeHtml(money(row.final_amount)) },
        { label: 'Đã thu', className: 'text-end money-positive', render: (row) => escapeHtml(money(row.paid_amount)) },
        {
            label: 'Còn lại',
            className: 'text-end',
            render: (row) => {
                const remaining = Number(row.final_amount) - Number(row.paid_amount);
                return remaining > 0
                    ? `<span class="money-danger">${escapeHtml(money(remaining))}</span>`
                    : '<span class="money-positive">0 đ</span>';
            }
        },
        {
            label: 'Trạng thái',
            render: (row) => {
                const meta = statusMeta('tuition', row.status);
                return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
            }
        }
    ]
});

const totalChip = qs('[data-report-total]');
const periodChip = qs('[data-report-period]');
const monthSelect = qs('[data-report-month]');
const yearSelect = qs('[data-report-year]');

function metric(name) {
    return qs(`[data-metric="${name}"] [data-stat-value]`);
}

function updateStats(rows) {
    const totals = rows.reduce((acc, row) => {
        acc.final += Number(row.final_amount) || 0;
        acc.paid += Number(row.paid_amount) || 0;
        return acc;
    }, { final: 0, paid: 0 });

    const set = (name, value) => {
        const node = metric(name);
        if (node) {
            node.textContent = value;
        }
    };
    set('final', money(totals.final));
    set('paid', money(totals.paid));
    set('debt', money(totals.final - totals.paid));
}

function renderPeriod() {
    if (periodChip) {
        periodChip.textContent = monthLabel(state.year, state.month);
    }
}

async function load() {
    if (state.loading) {
        return;
    }
    state.loading = true;
    table.setLoading();
    try {
        const params = new URLSearchParams();
        params.set('year', String(state.year));
        params.set('month', String(state.month));
        if (state.status) {
            params.set('status', state.status);
        }
        if (state.q) {
            params.set('q', state.q);
        }
        const payload = await api.get(`/reports/tuition?${params.toString()}`);
        const rows = payload?.data || [];
        table.render(rows);
        updateStats(rows);
        renderPeriod();
        if (totalChip) {
            totalChip.textContent = `${number(rows.length)} học viên`;
        }
    } catch (error) {
        table.setError(error.message || 'Không tải được báo cáo học phí');
        showToast(error.message || 'Không tải được báo cáo học phí', 'danger');
    } finally {
        state.loading = false;
    }
}

function fillSelects() {
    const monthOptions = [];
    for (let month = 1; month <= 12; month += 1) {
        monthOptions.push(`<option value="${month}">Tháng ${month}</option>`);
    }
    monthSelect.innerHTML = monthOptions.join('');
    monthSelect.value = String(state.month);

    const yearOptions = [];
    for (let offset = 2; offset >= -1; offset -= 1) {
        const year = now.getFullYear() - offset;
        yearOptions.push(`<option value="${year}">Năm ${year}</option>`);
    }
    yearSelect.innerHTML = yearOptions.join('');
    yearSelect.value = String(state.year);
}

function bindFilters() {
    qs('[data-report-status]')?.addEventListener('change', (event) => {
        state.status = event.target.value;
        load();
    });
    monthSelect?.addEventListener('change', (event) => {
        state.month = Number(event.target.value);
        load();
    });
    yearSelect?.addEventListener('change', (event) => {
        state.year = Number(event.target.value);
        load();
    });
    document.addEventListener('hk:toolbar-search', (event) => {
        state.q = event.detail?.value || '';
        load();
    });
    document.addEventListener('hk:toolbar-submit', (event) => {
        event.preventDefault();
        load();
    });
}

document.addEventListener('hk:ready', () => {
    fillSelects();
    bindFilters();
    load();
});
