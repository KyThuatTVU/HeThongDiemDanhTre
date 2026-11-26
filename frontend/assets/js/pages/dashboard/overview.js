import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { number, percent, date as formatDate, todayIso } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

let chartInstance = null;

function setStat(metric, value, hint) {
    const host = qs(`[data-metric="${metric}"]`);
    if (!host) {
        return;
    }
    const valueNode = host.querySelector('[data-stat-value]');
    const hintNode = host.querySelector('[data-stat-hint]');
    if (valueNode) {
        valueNode.textContent = value;
    }
    if (hintNode) {
        hintNode.textContent = hint || '';
        hintNode.hidden = !hint;
    }
}

function renderStats(overall) {
    setStat('students', number(overall.active_students ?? 0), `${number(overall.total_students ?? 0)} hồ sơ trong cơ sở`);
    setStat('present', number(overall.present_today ?? 0), `Đã ghi nhận ${number(overall.recorded_today ?? 0)} lượt`);
    setStat('absent', number(overall.absent_today ?? 0), 'Chưa tính học viên chưa điểm danh');
    setStat('rate', percent(overall.attendance_rate ?? 0), 'Trên số lượt đã ghi nhận');
}

function renderBranches(data) {
    const host = qs('[data-branch-summary]');
    if (!host) {
        return;
    }
    const branches = data.branches || [];
    if (!branches.length) {
        host.innerHTML = '<p class="text-muted-2 fs-13 mb-0">Chưa có dữ liệu cơ sở.</p>';
        return;
    }
    host.innerHTML = branches.map((branch) => {
        const current = Number(branch.branch_id) === Number(data.current_branch_id);
        return `
            <div class="branch-summary-item${current ? ' branch-summary-item--current' : ''}">
                <div>
                    <p class="branch-summary-item__name">${escapeHtml(branch.branch_name)}${current ? ' <span class="hk-chip ms-1">Đang chọn</span>' : ''}</p>
                    <p class="branch-summary-item__meta">
                        ${number(branch.active_students)} đang học · ${number(branch.present_today)} có mặt · ${number(branch.absent_today)} vắng
                    </p>
                </div>
                <span class="branch-summary-item__rate">${percent(branch.attendance_rate)}</span>
            </div>`;
    }).join('');
}

function renderChart(chart) {
    const canvas = qs('[data-chart-canvas]');
    if (!canvas || !window.Chart) {
        return;
    }
    const series = chart?.series || [];
    const labels = series.map((item) => formatDate(item.date).slice(0, 5));
    if (chartInstance) {
        chartInstance.destroy();
    }
    chartInstance = new window.Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Có mặt',
                    data: series.map((item) => Number(item.present || 0)),
                    backgroundColor: '#1E9482',
                    borderRadius: 5,
                    maxBarThickness: 26,
                    stack: 'attendance'
                },
                {
                    label: 'Vắng',
                    data: series.map((item) => Number(item.absent || 0)),
                    backgroundColor: '#F59E0B',
                    borderRadius: 5,
                    maxBarThickness: 26,
                    stack: 'attendance'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { font: { family: 'Quicksand', size: 11 } }
                },
                y: {
                    stacked: true,
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

async function load() {
    const dateNode = qs('[data-dashboard-date]');
    if (dateNode) {
        dateNode.textContent = formatDate(todayIso());
    }
    try {
        const payload = await api.get('/dashboard/summary');
        const data = payload?.data || {};
        renderStats(data.overall || {});
        renderBranches(data);
        renderChart(data.chart || {});
    } catch (error) {
        showToast(error.message || 'Không tải được số liệu tổng quan', 'danger');
        setStat('students', '—', 'Lỗi tải dữ liệu');
    }
}

document.addEventListener('hk:ready', load);
