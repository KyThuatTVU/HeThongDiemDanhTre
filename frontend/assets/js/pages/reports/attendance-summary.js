import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { can } from '../../core/auth.js';
import { monthLabel, number, percent } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

const now = new Date();
const state = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    classId: '',
    loading: false
};

const table = createTable(qs('[data-report-table]'), {
    emptyTitle: 'Chưa có dữ liệu',
    emptyHint: 'Chưa có lượt điểm danh nào trong tháng được chọn.',
    emptyIcon: 'bi-clipboard2-pulse',
    columns: [
        {
            label: 'Học viên',
            render: (row) => `<span class="cell-title">${escapeHtml(row.full_name)}</span>
                <span class="cell-meta">${escapeHtml(row.student_code)}</span>`
        },
        { label: 'Lớp', render: (row) => escapeHtml(row.class_name || '—') },
        { label: 'Có mặt', className: 'text-end', render: (row) => escapeHtml(number(row.present)) },
        { label: 'Đi trễ', className: 'text-end', render: (row) => escapeHtml(number(row.late)) },
        { label: 'Có phép', className: 'text-end', render: (row) => escapeHtml(number(row.excused_absent)) },
        { label: 'Không phép', className: 'text-end', render: (row) => escapeHtml(number(row.unexcused_absent)) },
        { label: 'Báo trước', className: 'text-end', render: (row) => escapeHtml(number(row.planned_leave)) },
        { label: 'Tổng lượt', className: 'text-end', render: (row) => escapeHtml(number(row.total)) },
        {
            label: 'Tỉ lệ',
            className: 'text-end',
            render: (row) => {
                if (row.attendance_rate === null || row.attendance_rate === undefined) {
                    return '<span class="text-muted-2">—</span>';
                }
                const rate = Number(row.attendance_rate);
                const tone = rate >= 90 ? 'success' : (rate >= 75 ? 'warning' : 'danger');
                return `<span class="hk-badge hk-badge--${tone}">${escapeHtml(percent(rate))}</span>`;
            }
        }
    ]
});

const totalChip = qs('[data-report-total]');
const periodChip = qs('[data-report-period]');
const monthSelect = qs('[data-report-month]');
const yearSelect = qs('[data-report-year]');
const classSelect = qs('[data-report-class]');
const classWrap = qs('[data-class-filter]');

function metric(name) {
    return qs(`[data-metric="${name}"] [data-stat-value]`);
}

function metricHint(name) {
    return qs(`[data-metric="${name}"] [data-stat-hint]`);
}

function updateStats(rows) {
    const totals = rows.reduce((acc, row) => {
        acc.total += Number(row.total) || 0;
        acc.present += Number(row.present_total) || 0;
        acc.absent += Number(row.absent_total) || 0;
        return acc;
    }, { total: 0, present: 0, absent: 0 });

    const set = (name, value) => {
        const node = metric(name);
        if (node) {
            node.textContent = value;
        }
    };
    set('total', number(totals.total));
    set('present', number(totals.present));
    set('absent', number(totals.absent));
    set('rate', totals.total > 0 ? percent(totals.present * 100 / totals.total) : '—');

    const hint = metricHint('rate');
    if (hint) {
        hint.textContent = `${rows.length} học viên`;
        hint.hidden = false;
    }
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
        if (state.classId) {
            params.set('class_id', state.classId);
        }
        const payload = await api.get(`/reports/attendance-summary?${params.toString()}`);
        const rows = payload?.data || [];
        table.render(rows);
        updateStats(rows);
        renderPeriod();
        if (totalChip) {
            totalChip.textContent = `${number(rows.length)} học viên`;
        }
    } catch (error) {
        table.setError(error.message || 'Không tải được báo cáo tổng hợp');
        showToast(error.message || 'Không tải được báo cáo tổng hợp', 'danger');
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
    monthSelect?.addEventListener('change', (event) => {
        state.month = Number(event.target.value);
        load();
    });
    yearSelect?.addEventListener('change', (event) => {
        state.year = Number(event.target.value);
        load();
    });
    classSelect?.addEventListener('change', (event) => {
        state.classId = event.target.value;
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
    loadClasses();
    load();
});
