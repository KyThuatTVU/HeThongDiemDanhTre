import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { createModal, showFormErrors } from '../../../../components/modal/modal.js';
import { can } from '../../core/auth.js';
import { date, datetime, labels, money, monthLabel, number, statusMeta, todayIso } from '../../core/format.js';
import { escapeHtml, qs, queryParam, setLoading } from '../../core/dom.js';
import { PAGES, pageUrl } from '../../core/config.js';

const recordId = Number(queryParam('id') || 0);
let detail = null;

const paymentsTable = createTable(qs('[data-payments-table]'), {
    emptyTitle: 'Chưa có lần thu nào',
    emptyHint: 'Bấm "Thu học phí" để ghi nhận lần thanh toán đầu tiên.',
    emptyIcon: 'bi-cash-stack',
    columns: [
        { label: 'Ngày thu', render: (row) => escapeHtml(date(row.paid_on)) },
        { label: 'Số tiền', className: 'text-end', render: (row) => escapeHtml(money(row.amount)) },
        { label: 'Hình thức', render: (row) => escapeHtml(labels.paymentMethod(row.method)) },
        { label: 'Ghi chú', render: (row) => escapeHtml(row.note || '—') },
        { label: 'Người thu', render: (row) => escapeHtml(row.received_by_name || '—') }
    ]
});

const adjustmentsTable = createTable(qs('[data-adjustments-table]'), {
    emptyTitle: 'Chưa có giảm trừ',
    emptyHint: 'Các khoản giảm trừ như nghỉ dài ngày, ưu đãi gia đình sẽ hiển thị tại đây.',
    emptyIcon: 'bi-slash-circle',
    columns: [
        { label: 'Số tiền', className: 'text-end', render: (row) => escapeHtml(money(row.amount)) },
        { label: 'Lý do', render: (row) => escapeHtml(row.reason) },
        { label: 'Người tạo', render: (row) => escapeHtml(row.created_by_name || '—') },
        { label: 'Thời gian', render: (row) => escapeHtml(datetime(row.created_at)) }
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

function renderHero(record) {
    const main = qs('[data-fee-main]');
    if (!main) {
        return;
    }
    const meta = statusMeta('tuition', record.status);
    main.innerHTML = `
        <h1 class="fee-hero__student">
            <a href="../../students/detail/?id=${record.student_id}">${escapeHtml(record.student_name)}</a>
        </h1>
        <div class="fee-hero__meta">
            <span class="hk-chip">${escapeHtml(record.student_code)}</span>
            <span><i class="bi bi-diagram-3 me-1"></i>${escapeHtml(record.class_name || 'Chưa xếp lớp')}</span>
            <span><i class="bi bi-calendar3 me-1"></i>${escapeHtml(monthLabel(record.period_year, record.period_month))}</span>
            <span><i class="bi bi-geo-alt me-1"></i>${escapeHtml(record.branch_name || '—')}</span>
            <span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>
        </div>`;

    const collectButton = qs('[data-collect]');
    if (collectButton) {
        const paidEnough = Number(record.remaining_amount) <= 0;
        collectButton.disabled = paidEnough || !can('tuition.collect');
        collectButton.title = paidEnough ? 'Phiếu đã thu đủ' : '';
    }
    const adjustButton = qs('[data-adjust]');
    if (adjustButton && !can('tuition.adjust')) {
        adjustButton.hidden = true;
    }
}

function renderInfo(record) {
    const info = qs('[data-fee-info]');
    if (!info) {
        return;
    }
    info.innerHTML = `
        <dt>Kỳ thu</dt><dd>${escapeHtml(monthLabel(record.period_year, record.period_month))}</dd>
        <dt>Học phí thoả thuận</dt><dd>${escapeHtml(money(record.base_amount))}</dd>
        <dt>Tổng giảm trừ</dt><dd>${escapeHtml(money(record.deduction_amount))}</dd>
        <dt>Phải thu</dt><dd>${escapeHtml(money(record.final_amount))}</dd>
        <dt>Đã thu</dt><dd>${escapeHtml(money(record.paid_amount))}</dd>
        <dt>Còn lại</dt><dd>${escapeHtml(money(record.remaining_amount))}</dd>
        <dt>Ghi chú</dt><dd>${escapeHtml(record.note || '—')}</dd>
        <dt>Cập nhật</dt><dd>${escapeHtml(datetime(record.updated_at))}</dd>`;
}

function renderAttendance(counts) {
    const info = qs('[data-attendance-info]');
    const chip = qs('[data-attendance-total]');
    if (!info) {
        return;
    }
    const rows = [
        ['Có mặt', number(counts.present ?? 0)],
        ['Đi trễ', number(counts.late ?? 0)],
        ['Vắng có phép', number(counts.excused_absent ?? 0)],
        ['Vắng không phép', number(counts.unexcused_absent ?? 0)],
        ['Nghỉ báo trước', number(counts.planned_leave ?? 0)]
    ];
    info.innerHTML = rows.map(([label, value]) => `<dt>${label}</dt><dd>${value} lượt</dd>`).join('');
    if (chip) {
        chip.textContent = `${number(counts.present_total ?? 0)} có mặt · ${number(counts.absent_total ?? 0)} vắng`;
    }
}

function render(data) {
    detail = data;
    const record = data.record || {};
    document.title = `${record.student_name} · ${monthLabel(record.period_year, record.period_month)} · HappyKidsCK`;
    renderHero(record);
    renderInfo(record);
    renderAttendance(data.attendance || {});
    paymentsTable.render(data.payments || []);
    adjustmentsTable.render(data.adjustments || []);

    setStat('final', money(record.final_amount), 'Sau giảm trừ');
    setStat('paid', money(record.paid_amount), `${(data.payments || []).length} lần thu`);
    setStat('remaining', money(record.remaining_amount), Number(record.remaining_amount) > 0 ? 'Cần thu tiếp' : 'Đã thu đủ');
    setStat('deduction', money(record.deduction_amount), `${(data.adjustments || []).length} khoản giảm`);
}

async function load() {
    try {
        const payload = await api.get(`/tuition/${recordId}`);
        render(payload?.data || {});
    } catch (error) {
        showToast(error.message || 'Không tải được phiếu học phí', 'danger');
        const main = qs('[data-fee-main]');
        if (main) {
            main.innerHTML = `<p class="text-muted-2 mb-0">${escapeHtml(error.message || 'Không tải được phiếu học phí')}</p>`;
        }
    }
}

function openCollectModal() {
    if (!detail || !can('tuition.collect')) {
        return;
    }
    const record = detail.record;
    const remaining = Math.round(Number(record.remaining_amount || 0));
    if (remaining <= 0) {
        showToast('Phiếu này đã thu đủ', 'info');
        return;
    }

    const modal = createModal({ title: 'Thu học phí', size: 'sm' });
    const form = document.createElement('form');
    form.innerHTML = `
        <div class="mb-3">
            <label class="form-label" for="collect-amount">Số tiền thu (đ) <span class="text-danger">*</span></label>
            <input class="form-control" id="collect-amount" name="amount" type="number" min="1" step="1000"
                   value="${remaining}" required>
            <div class="form-text">Còn phải thu: ${escapeHtml(money(remaining))}</div>
        </div>
        <div class="mb-3">
            <label class="form-label" for="collect-date">Ngày thu</label>
            <input class="form-control" id="collect-date" name="paid_on" type="date" value="${todayIso()}">
        </div>
        <div class="mb-3">
            <label class="form-label" for="collect-method">Hình thức</label>
            <select class="form-select" id="collect-method" name="method">
                <option value="cash">Tiền mặt</option>
                <option value="transfer">Chuyển khoản</option>
                <option value="other">Khác</option>
            </select>
        </div>
        <div class="mb-3">
            <label class="form-label" for="collect-note">Ghi chú</label>
            <input class="form-control" id="collect-note" name="note" type="text" maxlength="255"
                   placeholder="Biên lai, người nộp...">
        </div>`;
    modal.setBody(form);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-hk-outline';
    cancel.textContent = 'Huỷ';
    cancel.dataset.bsDismiss = 'modal';

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn-hk';
    submit.textContent = 'Ghi nhận thu';
    submit.addEventListener('click', async () => {
        if (!form.reportValidity()) {
            return;
        }
        const amount = Number(form.elements.namedItem('amount').value);
        if (amount <= 0) {
            showToast('Số tiền thu phải lớn hơn 0', 'warning');
            return;
        }
        if (amount > remaining + 0.01) {
            showToast(`Số tiền vượt quá số còn phải thu (${money(remaining)})`, 'warning');
            return;
        }
        setLoading(submit, true, 'Đang ghi nhận...');
        try {
            await api.post(`/tuition/${record.id}/payments`, {
                amount,
                paid_on: form.elements.namedItem('paid_on').value || todayIso(),
                method: form.elements.namedItem('method').value,
                note: form.elements.namedItem('note').value.trim() || null
            });
            modal.hide();
            showToast('Đã ghi nhận thu học phí', 'success');
            load();
        } catch (error) {
            if (error.status === 422 && error.errors) {
                showFormErrors(form, error.errors);
            }
            showToast(error.message || 'Không ghi nhận được thanh toán', 'danger');
        } finally {
            setLoading(submit, false);
        }
    });

    modal.setFooter([cancel, submit]);
    modal.show();
}

function openAdjustModal() {
    if (!detail || !can('tuition.adjust')) {
        return;
    }
    const record = detail.record;
    const maxDeduction = Math.max(0, Number(record.base_amount) - Number(record.deduction_amount));
    if (maxDeduction <= 0) {
        showToast('Học phí thoả thuận đã được giảm toàn bộ', 'info');
        return;
    }

    const modal = createModal({ title: 'Thêm giảm trừ', size: 'sm' });
    const form = document.createElement('form');
    form.innerHTML = `
        <div class="mb-3">
            <label class="form-label" for="adjust-amount">Số tiền giảm (đ) <span class="text-danger">*</span></label>
            <input class="form-control" id="adjust-amount" name="amount" type="number" min="1" step="1000"
                   max="${maxDeduction}" required>
            <div class="form-text">Tối đa có thể giảm: ${escapeHtml(money(maxDeduction))}</div>
        </div>
        <div class="mb-3">
            <label class="form-label" for="adjust-reason">Lý do <span class="text-danger">*</span></label>
            <input class="form-control" id="adjust-reason" name="reason" type="text" maxlength="255"
                   placeholder="Ví dụ: Nghỉ ốm dài ngày, ưu đãi anh chị em..." required>
        </div>`;
    modal.setBody(form);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-hk-outline';
    cancel.textContent = 'Huỷ';
    cancel.dataset.bsDismiss = 'modal';

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn-hk';
    submit.textContent = 'Thêm giảm trừ';
    submit.addEventListener('click', async () => {
        if (!form.reportValidity()) {
            return;
        }
        setLoading(submit, true, 'Đang lưu...');
        try {
            await api.post(`/tuition/${record.id}/adjustments`, {
                amount: Number(form.elements.namedItem('amount').value),
                reason: form.elements.namedItem('reason').value.trim()
            });
            modal.hide();
            showToast('Đã thêm khoản giảm trừ', 'success');
            load();
        } catch (error) {
            if (error.status === 422 && error.errors) {
                showFormErrors(form, error.errors);
            }
            showToast(error.message || 'Không thêm được giảm trừ', 'danger');
        } finally {
            setLoading(submit, false);
        }
    });

    modal.setFooter([cancel, submit]);
    modal.show();
}

document.addEventListener('hk:ready', () => {
    if (!recordId) {
        showToast('Thiếu mã phiếu học phí', 'warning');
        window.location.replace(pageUrl(PAGES.tuitionList));
        return;
    }
    qs('[data-collect]')?.addEventListener('click', openCollectModal);
    qs('[data-adjust]')?.addEventListener('click', openAdjustModal);
    load();
});
