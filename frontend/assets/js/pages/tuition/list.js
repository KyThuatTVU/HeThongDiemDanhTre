import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { renderPagination } from '../../../../components/pagination/pagination.js';
import { createModal } from '../../../../components/modal/modal.js';
import { can } from '../../core/auth.js';
import { money, monthLabel, number, statusMeta } from '../../core/format.js';
import { escapeHtml, qs, setLoading } from '../../core/dom.js';

const now = new Date();
const state = {
    page: 1,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    status: '',
    q: '',
    loading: false
};

const table = createTable(qs('[data-tuition-table]'), {
    emptyTitle: 'Chưa có bảng học phí',
    emptyHint: 'Bấm "Tạo bảng học phí" để sinh phiếu thu cho học viên đang học trong tháng.',
    emptyIcon: 'bi-receipt',
    columns: [
        {
            label: 'Học viên',
            render: (row) => `
                <a class="tuition-name" href="../../students/detail/?id=${row.student_id}">${escapeHtml(row.student_name)}</a>
                <span class="fs-13 text-muted-2">${escapeHtml(row.student_code)}</span>`
        },
        { label: 'Lớp', render: (row) => row.class_name ? escapeHtml(row.class_name) : '<span class="text-muted-2">—</span>' },
        { label: 'Phải thu', className: 'text-end', render: (row) => escapeHtml(money(row.final_amount)) },
        { label: 'Đã thu', className: 'text-end', render: (row) => `<span class="amount-paid">${escapeHtml(money(row.paid_amount))}</span>` },
        {
            label: 'Còn lại',
            className: 'text-end',
            render: (row) => row.remaining_amount > 0
                ? `<span class="amount-debt">${escapeHtml(money(row.remaining_amount))}</span>`
                : '<span class="text-muted-2">0 đ</span>'
        },
        {
            label: 'Trạng thái',
            render: (row) => {
                const meta = statusMeta('tuition', row.status);
                return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
            }
        },
        {
            label: 'Thao tác',
            headerClass: 'text-end',
            render: (row) => `<a class="btn btn-sm btn-light" href="../detail/?id=${row.id}" title="Xem phiếu thu"><i class="bi bi-arrow-right"></i></a>`
        }
    ]
});

function setStat(name, value, hint) {
    const host = qs(`[data-stat="${name}"]`);
    if (!host) {
        return;
    }
    const valueNode = host.querySelector('[data-stat-value]');
    const hintNode = host.querySelector('[data-stat-hint]');
    if (valueNode) valueNode.textContent = value;
    if (hintNode) {
        hintNode.textContent = hint || '';
        hintNode.hidden = !hint;
    }
}

function buildYearOptions() {
    const select = qs('[data-year]');
    if (!select) {
        return;
    }
    const years = [];
    for (let year = now.getFullYear() - 2; year <= now.getFullYear() + 1; year += 1) {
        years.push(year);
    }
    select.innerHTML = years.map((year) => `<option value="${year}">Năm ${year}</option>`).join('');
    select.value = String(state.year);
}

async function load() {
    if (state.loading) {
        return;
    }
    state.loading = true;
    table.setLoading();
    const title = qs('[data-tuition-title]');
    if (title) {
        title.textContent = `Bảng học phí ${monthLabel(state.year, state.month)}`;
    }
    try {
        const payload = await api.get('/tuition', {
            page: state.page,
            year: state.year,
            month: state.month,
            status: state.status,
            q: state.q
        });
        table.render(payload?.data || []);
        renderPagination(qs('[data-tuition-pagination]'), payload?.meta || {}, (page) => {
            state.page = page;
            load();
        });
        const totals = payload?.meta?.totals || {};
        setStat('final', money(totals.final_total ?? 0), `${number(payload?.meta?.total ?? 0)} phiếu thu`);
        setStat('paid', money(totals.paid_total ?? 0), 'Tổng đã ghi nhận');
        setStat('debt', money(totals.debt_total ?? 0), 'Cần thu tiếp');
        const countNode = qs('[data-tuition-count]');
        if (countNode) {
            countNode.textContent = `${number(payload?.meta?.total ?? 0)} phiếu`;
        }
    } catch (error) {
        table.setError(error.message || 'Không tải được bảng học phí');
        showToast(error.message || 'Không tải được bảng học phí', 'danger');
    } finally {
        state.loading = false;
    }
}

function openGenerateModal() {
    if (!can('tuition.generate')) {
        showToast('Bạn không có quyền tạo bảng học phí', 'warning');
        return;
    }
    const modal = createModal({ title: 'Tạo bảng học phí tháng', size: 'sm' });
    const form = document.createElement('form');
    const monthOptions = Array.from({ length: 12 }, (_, index) =>
        `<option value="${index + 1}"${index + 1 === state.month ? ' selected' : ''}>Tháng ${index + 1}</option>`
    ).join('');
    const yearOptions = (() => {
        const years = [];
        for (let year = now.getFullYear() - 2; year <= now.getFullYear() + 1; year += 1) {
            years.push(year);
        }
        return years.map((year) => `<option value="${year}"${year === state.year ? ' selected' : ''}>Năm ${year}</option>`).join('');
    })();
    form.innerHTML = `
        <div class="mb-3">
            <label class="form-label" for="gen-month">Tháng</label>
            <select class="form-select" id="gen-month">${monthOptions}</select>
        </div>
        <div class="mb-3">
            <label class="form-label" for="gen-year">Năm</label>
            <select class="form-select" id="gen-year">${yearOptions}</select>
        </div>
        <p class="fs-13 text-muted-2 mb-0">
            Hệ thống tạo phiếu cho học viên đang học, học phí lấy theo mức thoả thuận trong hồ sơ.
            Học viên đã có phiếu trong tháng sẽ được bỏ qua.
        </p>`;
    modal.setBody(form);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-hk-outline';
    cancel.textContent = 'Huỷ';
    cancel.dataset.bsDismiss = 'modal';

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn-hk';
    submit.textContent = 'Tạo bảng';
    submit.addEventListener('click', async () => {
        setLoading(submit, true, 'Đang tạo...');
        try {
            const year = Number(form.querySelector('#gen-year').value);
            const month = Number(form.querySelector('#gen-month').value);
            const response = await api.post('/tuition/generate', { year, month });
            const created = response?.data?.created ?? 0;
            const skipped = response?.data?.skipped ?? 0;
            modal.hide();
            showToast(`Đã tạo ${created} phiếu mới, bỏ qua ${skipped} hồ sơ đã có`, created ? 'success' : 'info');
            state.year = year;
            state.month = month;
            state.page = 1;
            qs('[data-year]').value = String(year);
            qs('[data-month]').value = String(month);
            load();
        } catch (error) {
            showToast(error.message || 'Không tạo được bảng học phí', 'danger');
        } finally {
            setLoading(submit, false);
        }
    });

    modal.setFooter([cancel, submit]);
    modal.show();
}

document.addEventListener('hk:toolbar-search', (event) => {
    state.q = event.detail?.value || '';
    state.page = 1;
    load();
});

document.addEventListener('hk:toolbar-submit', (event) => {
    event.preventDefault();
});

document.addEventListener('hk:ready', () => {
    const monthSelect = qs('[data-month]');
    const yearSelect = qs('[data-year]');
    monthSelect.value = String(state.month);
    buildYearOptions();

    monthSelect.addEventListener('change', () => {
        state.month = Number(monthSelect.value);
        state.page = 1;
        load();
    });
    yearSelect.addEventListener('change', () => {
        state.year = Number(yearSelect.value);
        state.page = 1;
        load();
    });
    qs('[data-status]')?.addEventListener('change', (event) => {
        state.status = event.target.value;
        state.page = 1;
        load();
    });

    const generateButton = qs('[data-generate]');
    if (generateButton && can('tuition.generate')) {
        generateButton.addEventListener('click', openGenerateModal);
    }

    load();
});
