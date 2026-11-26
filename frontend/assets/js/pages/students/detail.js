import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { createModal, confirmAction, showFormErrors } from '../../../../components/modal/modal.js';
import { flash } from '../../core/flash.js';
import { can, session } from '../../core/auth.js';
import { date, datetime, initials, labels, money, monthLabel, statusMeta, weekdayLabel } from '../../core/format.js';
import { escapeHtml, qs, queryParam, setLoading } from '../../core/dom.js';
import { fileUrl, PAGES, pageUrl } from '../../core/config.js';

const studentId = Number(queryParam('id') || 0);
let detail = null;

const attendanceTable = createTable(qs('[data-attendance-table]'), {
    emptyTitle: 'Chưa có lượt điểm danh',
    emptyHint: 'Học viên chưa được ghi nhận trong phiên điểm danh nào.',
    emptyIcon: 'bi-calendar2-x',
    columns: [
        {
            label: 'Ngày',
            render: (row) => `<span class="d-block">${escapeHtml(date(row.session_date))}</span>
                <span class="fs-13 text-muted-2">${escapeHtml(weekdayLabel(row.session_date))}</span>`
        },
        { label: 'Ca học', render: (row) => escapeHtml(row.slot_name || '—') },
        {
            label: 'Trạng thái',
            render: (row) => {
                const meta = statusMeta('attendance', row.status);
                return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
            }
        },
        { label: 'Ghi chú', render: (row) => escapeHtml(row.note || '—') },
        { label: 'Người ghi', render: (row) => escapeHtml(row.recorded_by_name || '—') }
    ]
});

const tuitionTable = createTable(qs('[data-tuition-table]'), {
    emptyTitle: 'Chưa có bản ghi học phí',
    emptyHint: 'Học phí được tạo theo tháng tại trang quản lý học phí.',
    emptyIcon: 'bi-cash-stack',
    columns: [
        { label: 'Kỳ thu', render: (row) => escapeHtml(monthLabel(row.period_year, row.period_month)) },
        { label: 'Phải thu', className: 'text-end', render: (row) => escapeHtml(money(row.final_amount)) },
        { label: 'Đã thu', className: 'text-end', render: (row) => escapeHtml(money(row.paid_amount)) },
        {
            label: 'Trạng thái',
            render: (row) => {
                const meta = statusMeta('tuition', row.status);
                return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
            }
        },
        {
            label: '',
            headerClass: 'text-end',
            render: (row) => `<a class="btn btn-sm btn-light" href="../../tuition/detail/?id=${row.id}" title="Xem phiếu học phí"><i class="bi bi-arrow-right"></i></a>`
        }
    ]
});

function renderAvatar(student) {
    const avatar = qs('[data-avatar]');
    if (!avatar) {
        return;
    }
    if (student.avatar_path) {
        avatar.classList.remove('hk-avatar--fallback');
        avatar.innerHTML = `<img src="${escapeHtml(fileUrl(student.avatar_path))}" alt="${escapeHtml(student.full_name)}">`;
    } else {
        avatar.classList.add('hk-avatar--fallback');
        avatar.textContent = initials(student.full_name);
    }
    const upload = qs('[data-avatar-upload]');
    if (upload) {
        upload.hidden = !can('students.update') || Boolean(student.deleted_at);
    }
}

function renderHero(student) {
    const main = qs('[data-hero-main]');
    if (!main) {
        return;
    }
    const status = student.deleted_at
        ? '<span class="hk-badge hk-badge--danger">Đã xoá</span>'
        : (() => {
            const meta = statusMeta('student', student.status);
            return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
        })();

    main.innerHTML = `
        <h1 class="detail-hero__name">${escapeHtml(student.full_name)}</h1>
        <div class="detail-hero__meta">
            <span class="hk-chip">${escapeHtml(student.student_code)}</span>
            <span><i class="bi bi-diagram-3 me-1"></i>${escapeHtml(student.class_name || 'Chưa xếp lớp')}</span>
            <span><i class="bi bi-geo-alt me-1"></i>${escapeHtml(student.branch_name || '—')}</span>
            <span><i class="bi bi-telephone me-1"></i>${escapeHtml(student.guardian_phone || 'Chưa có SĐT')}</span>
            ${status}
        </div>`;

    const actions = qs('[data-detail-actions]');
    if (!actions) {
        return;
    }
    const buttons = [];
    if (!student.deleted_at && can('students.update')) {
        buttons.push(`<a class="btn-hk" href="../form/?id=${student.id}"><i class="bi bi-pencil me-1"></i>Sửa hồ sơ</a>`);
    }
    if (!student.deleted_at && can('students.transfer') && session.branches.length > 1) {
        buttons.push('<button type="button" class="btn-hk-outline" data-action="transfer"><i class="bi bi-arrow-left-right me-1"></i>Chuyển cơ sở</button>');
    }
    if (student.deleted_at && can('students.restore')) {
        buttons.push('<button type="button" class="btn-hk-outline text-success" data-action="restore"><i class="bi bi-arrow-counterclockwise me-1"></i>Khôi phục</button>');
    }
    if (!student.deleted_at && can('students.delete')) {
        buttons.push('<button type="button" class="btn-soft-danger" data-action="delete"><i class="bi bi-trash3 me-1"></i>Xoá</button>');
    }
    actions.innerHTML = buttons.join('');
}

function renderInfo(student) {
    const info = qs('[data-info]');
    if (!info) {
        return;
    }
    const rows = [
        ['Ngày sinh', date(student.dob)],
        ['Giới tính', labels.gender(student.gender)],
        ['Hình thức học', escapeHtml(student.study_format || '—')],
        ['Học phí thoả thuận', money(student.monthly_fee)],
        ['Ngày nhập học', date(student.enrollment_date)],
        ['Mã định danh', escapeHtml(student.identity_code || '—')],
        ['Địa chỉ', escapeHtml(student.address || '—')],
        ['Ghi chú', escapeHtml(student.notes || '—')]
    ];
    info.innerHTML = rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('');

    const guardian = qs('[data-guardian]');
    if (guardian) {
        guardian.innerHTML = `
            <dt>Họ tên</dt><dd>${escapeHtml(student.guardian_name || '—')}</dd>
            <dt>Số điện thoại</dt>
            <dd>${student.guardian_phone
                ? `<a class="text-tel" href="tel:${escapeHtml(student.guardian_phone)}">${escapeHtml(student.guardian_phone)}</a>`
                : '—'}</dd>
            <dt>Cơ sở</dt><dd>${escapeHtml(student.branch_name || '—')}</dd>
            <dt>Lớp hiện tại</dt><dd>${escapeHtml(student.class_name || 'Chưa xếp lớp')}</dd>`;
    }
}

function renderClassHistory(histories) {
    const host = qs('[data-class-history]');
    if (!host) {
        return;
    }
    if (!histories.length) {
        host.innerHTML = '<p class="text-muted-2 fs-13 mb-0">Chưa có lịch sử lớp.</p>';
        return;
    }
    host.innerHTML = histories.map((item) => `
        <div class="history-item">
            <p class="history-item__title">${escapeHtml(item.class_name)}</p>
            <p class="history-item__meta">
                ${escapeHtml(date(item.joined_at))} → ${item.left_at ? escapeHtml(date(item.left_at)) : 'hiện tại'}
            </p>
            ${item.reason ? `<p class="history-item__reason">${escapeHtml(item.reason)}</p>` : ''}
        </div>`).join('');
}

function renderBranchHistory(histories) {
    const card = qs('[data-branch-history-card]');
    const host = qs('[data-branch-history]');
    if (!card || !host) {
        return;
    }
    if (!histories.length) {
        card.hidden = true;
        return;
    }
    card.hidden = false;
    host.innerHTML = histories.map((item) => `
        <div class="history-item">
            <p class="history-item__title">${escapeHtml(item.from_branch_name)} → ${escapeHtml(item.to_branch_name)}</p>
            <p class="history-item__meta">
                ${escapeHtml(datetime(item.moved_at))}${item.performed_by_name ? ` · ${escapeHtml(item.performed_by_name)}` : ''}
            </p>
            ${item.reason ? `<p class="history-item__reason">${escapeHtml(item.reason)}</p>` : ''}
        </div>`).join('');
}

function render(data) {
    const student = data.student || {};
    detail = data;
    document.title = `${student.full_name} · HappyKidsCK`;
    renderAvatar(student);
    renderHero(student);
    renderInfo(student);
    attendanceTable.render(data.recent_attendance || []);
    tuitionTable.render(data.recent_tuition || []);
    renderClassHistory(data.class_histories || []);
    renderBranchHistory(data.branch_histories || []);
}

async function load() {
    try {
        const payload = await api.get(`/students/${studentId}`);
        render(payload?.data || {});
    } catch (error) {
        showToast(error.message || 'Không tải được hồ sơ học viên', 'danger');
        qs('[data-hero-main]').innerHTML = `<p class="text-muted-2 mb-0">${escapeHtml(error.message || 'Không tải được hồ sơ học viên')}</p>`;
    }
}

function openTransferModal() {
    if (!detail) {
        return;
    }
    const student = detail.student;
    const targets = session.branches.filter((branch) => Number(branch.id) !== Number(student.branch_id));
    if (!targets.length) {
        showToast('Bạn không có cơ sở nào khác để chuyển đến', 'warning');
        return;
    }

    const modal = createModal({ title: 'Chuyển cơ sở', size: 'sm' });
    const form = document.createElement('form');
    form.className = 'branch-transfer-form';
    form.innerHTML = `
        <div class="hk-field">
            <label class="form-label" for="to-branch">Cơ sở đích <span class="text-danger">*</span></label>
            <select class="form-select" id="to-branch" name="to_branch_id" required>
                <option value="">Chọn cơ sở</option>
                ${targets.map((branch) => `<option value="${branch.id}">${escapeHtml(branch.name)}</option>`).join('')}
            </select>
        </div>
        <div class="hk-field">
            <label class="form-label" for="transfer-reason">Lý do</label>
            <textarea class="form-control" id="transfer-reason" name="reason" rows="2" maxlength="255"
                      placeholder="Ví dụ: Gia đình chuyển nơi ở"></textarea>
        </div>
        <p class="fs-13 text-muted-2 mb-0">Học viên sẽ được gỡ khỏi lớp hiện tại và cần xếp lớp lại ở cơ sở mới.</p>`;
    modal.setBody(form);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-hk-outline';
    cancel.textContent = 'Huỷ';
    cancel.dataset.bsDismiss = 'modal';

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn-hk';
    submit.textContent = 'Chuyển cơ sở';
    submit.addEventListener('click', async () => {
        if (!form.reportValidity()) {
            return;
        }
        setLoading(submit, true, 'Đang chuyển...');
        try {
            await api.post(`/students/${student.id}/transfer-branch`, {
                to_branch_id: Number(form.elements.namedItem('to_branch_id').value),
                reason: form.elements.namedItem('reason').value.trim() || null
            });
            flash('Đã chuyển học viên sang cơ sở mới', 'success');
            modal.hide();
            window.location.reload();
        } catch (error) {
            if (error.status === 422 && error.errors) {
                showFormErrors(form, error.errors);
            }
            showToast(error.message || 'Không chuyển được cơ sở', 'danger');
        } finally {
            setLoading(submit, false);
        }
    });

    modal.setFooter([cancel, submit]);
    modal.show();
}

async function uploadAvatar(file) {
    if (!file) {
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        showToast('Ảnh vượt quá 2MB, vui lòng chọn ảnh nhỏ hơn', 'warning');
        return;
    }
    const formData = new FormData();
    formData.append('avatar', file);
    try {
        const response = await api.upload('POST', `/students/${studentId}/avatar`, formData);
        if (detail?.student) {
            detail.student.avatar_path = response?.data?.avatar_path || null;
            renderAvatar(detail.student);
        }
        showToast('Đã cập nhật ảnh học viên', 'success');
    } catch (error) {
        showToast(error.message || 'Không cập nhật được ảnh', 'danger');
    }
}

qs('[data-detail-actions]')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || !detail) {
        return;
    }
    const student = detail.student;
    if (button.dataset.action === 'transfer') {
        openTransferModal();
    }
    if (button.dataset.action === 'delete') {
        const confirmed = await confirmAction({
            title: 'Xoá học viên',
            message: `Xoá hồ sơ "${student.full_name}"? Có thể khôi phục lại sau.`,
            confirmText: 'Xoá học viên'
        });
        if (!confirmed) {
            return;
        }
        try {
            await api.delete(`/students/${student.id}`);
            flash('Đã xoá học viên', 'success');
            window.location.href = pageUrl(PAGES.students);
        } catch (error) {
            showToast(error.message || 'Không xoá được học viên', 'danger');
        }
    }
    if (button.dataset.action === 'restore') {
        const confirmed = await confirmAction({
            title: 'Khôi phục học viên',
            message: 'Khôi phục hồ sơ học viên này trở lại danh sách?',
            tone: 'warning',
            confirmText: 'Khôi phục'
        });
        if (!confirmed) {
            return;
        }
        try {
            await api.post(`/students/${student.id}/restore`);
            showToast('Đã khôi phục học viên', 'success');
            load();
        } catch (error) {
            showToast(error.message || 'Không khôi phục được học viên', 'danger');
        }
    }
});

qs('[data-avatar-input]')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    uploadAvatar(file);
});

document.addEventListener('hk:ready', () => {
    if (!studentId) {
        showToast('Thiếu mã học viên cần xem', 'warning');
        window.location.replace(pageUrl(PAGES.students));
        return;
    }
    load();
});
