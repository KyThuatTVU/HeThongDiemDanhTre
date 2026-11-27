import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { createModal } from '../../../../components/modal/modal.js';
import { money, monthLabel, number, statusMeta } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

const now = new Date();
const state = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    status: '',
    q: '',
    rows: [],
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
                <span class="cell-meta">${escapeHtml(row.class_name || row.student_code)}</span>`
        },
        { label: 'Lớp', mobileHide: true, render: (row) => escapeHtml(row.class_name || '—') },
        { label: 'Phải thu', mobileHide: true, className: 'text-end', render: (row) => escapeHtml(money(row.final_amount)) },
        { label: 'Đã thu', mobileHide: true, className: 'text-end money-positive', render: (row) => escapeHtml(money(row.paid_amount)) },
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
            mobileHide: true,
            render: (row) => {
                const meta = statusMeta('tuition', row.status);
                return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
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
        state.rows = rows;
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

function openTuitionReportDetail(row) {
    const meta = statusMeta('tuition', row.status);
    const remaining = Number(row.final_amount) - Number(row.paid_amount);
    const modal = createModal({ title: row.student_name || 'Chi tiết học phí', size: 'sm' });
    const body = document.createElement('dl');
    body.className = 'info-list';
    body.innerHTML = `
        <dt>Mã học viên</dt><dd>${escapeHtml(row.student_code || '—')}</dd>
        <dt>Lớp</dt><dd>${escapeHtml(row.class_name || '—')}</dd>
        <dt>Phải thu</dt><dd>${escapeHtml(money(row.final_amount))}</dd>
        <dt>Đã thu</dt><dd class="money-positive">${escapeHtml(money(row.paid_amount))}</dd>
        <dt>Còn lại</dt><dd class="${remaining > 0 ? 'money-danger' : 'money-positive'}">${escapeHtml(money(Math.max(0, remaining)))}</dd>
        <dt>Trạng thái</dt><dd><span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span></dd>`;
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
            openTuitionReportDetail(row);
        }
    });

    fillSelects();
    bindFilters();
    load();
});
