import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { monthLabel, number } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

const now = new Date();
const state = {
    year: now.getFullYear(),
    loading: false
};

let chartInstance = null;

const table = createTable(qs('[data-report-table]'), {
    mobileCompact: true,
    emptyTitle: 'Chưa có dữ liệu',
    emptyHint: 'Chưa có dữ liệu biến động trong năm được chọn.',
    emptyIcon: 'bi-arrow-left-right',
    columns: [
        { label: 'Tháng', render: (row) => escapeHtml(monthLabel(state.year, row.month)) },
        { label: 'Nhập học mới', className: 'text-end', render: (row) => escapeHtml(number(row.new_students)) },
        { label: 'Nghỉ học', className: 'text-end', render: (row) => escapeHtml(number(row.left_students)) },
        {
            label: 'Chênh lệch',
            className: 'text-end',
            render: (row) => {
                const diff = Number(row.new_students) - Number(row.left_students);
                if (diff === 0) {
                    return '<span class="hk-badge hk-badge--neutral">0</span>';
                }
                const tone = diff > 0 ? 'success' : 'danger';
                const prefix = diff > 0 ? '+' : '';
                return `<span class="hk-badge hk-badge--${tone}">${prefix}${escapeHtml(number(diff))}</span>`;
            }
        }
    ]
});

const yearSelect = qs('[data-report-year]');
const periodChip = qs('[data-report-period]');

function metric(name) {
    return qs(`[data-metric="${name}"] [data-stat-value]`);
}

function updateStats(months) {
    const totals = months.reduce((acc, row) => {
        acc.new += Number(row.new_students) || 0;
        acc.left += Number(row.left_students) || 0;
        return acc;
    }, { new: 0, left: 0 });

    const set = (name, value, hint) => {
        const node = metric(name);
        if (node) {
            node.textContent = value;
        }
        const host = qs(`[data-metric="${name}"] [data-stat-hint]`);
        if (host) {
            host.textContent = hint;
            host.hidden = !hint;
        }
    };
    set('new', number(totals.new), 'Hồ sơ có ngày nhập học trong năm');
    set('left', number(totals.left), 'Hồ sơ chuyển sang trạng thái đã nghỉ');
    set('net', `${totals.new - totals.left > 0 ? '+' : ''}${number(totals.new - totals.left)}`, 'Nhập học trừ nghỉ học');
}

function renderChart(months) {
    const canvas = qs('[data-chart-canvas]');
    if (!canvas || !window.Chart) {
        return;
    }
    if (chartInstance) {
        chartInstance.destroy();
    }
    chartInstance = new window.Chart(canvas, {
        type: 'bar',
        data: {
            labels: months.map((row) => `T${row.month}`),
            datasets: [
                {
                    label: 'Nhập học',
                    data: months.map((row) => Number(row.new_students || 0)),
                    backgroundColor: '#1E9482',
                    borderRadius: 5,
                    maxBarThickness: 26
                },
                {
                    label: 'Nghỉ học',
                    data: months.map((row) => Number(row.left_students || 0)),
                    backgroundColor: '#F59E0B',
                    borderRadius: 5,
                    maxBarThickness: 26
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Quicksand', size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(32, 48, 44, 0.07)' },
                    ticks: { precision: 0, font: { family: 'Quicksand', size: 11 } }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        font: { family: 'Quicksand', size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: '#0B4239',
                    padding: 10,
                    cornerRadius: 8,
                    titleFont: { family: 'Quicksand' },
                    bodyFont: { family: 'Quicksand' }
                }
            }
        }
    });
}

function render(months) {
    table.render(months);
    updateStats(months);
    renderChart(months);
    if (periodChip) {
        periodChip.textContent = `Năm ${state.year}`;
    }
}

async function load() {
    if (state.loading) {
        return;
    }
    state.loading = true;
    table.setLoading();
    try {
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        const payload = await api.get(`/reports/movements?year=${state.year}`);
        const months = payload?.data?.months || [];
        render(months);
    } catch (error) {
        table.setError(error.message || 'Không tải được báo cáo biến động');
        showToast(error.message || 'Không tải được báo cáo biến động', 'danger');
    } finally {
        state.loading = false;
    }
}

function fillYearSelect() {
    const options = [];
    for (let offset = 2; offset >= -1; offset -= 1) {
        const year = now.getFullYear() - offset;
        options.push(`<option value="${year}">Năm ${year}</option>`);
    }
    yearSelect.innerHTML = options.join('');
    yearSelect.value = String(state.year);
}

document.addEventListener('hk:ready', () => {
    fillYearSelect();
    yearSelect?.addEventListener('change', (event) => {
        state.year = Number(event.target.value);
        load();
    });
    document.addEventListener('hk:toolbar-submit', (event) => {
        event.preventDefault();
        load();
    });
    load();
});
