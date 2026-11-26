import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { createModal, showFormErrors } from '../../../../components/modal/modal.js';
import { flash } from '../../core/flash.js';
import { can } from '../../core/auth.js';
import { date, number, statusMeta, todayIso } from '../../core/format.js';
import { debounce, escapeHtml, qs, queryParam, setLoading } from '../../core/dom.js';
import { PAGES, pageUrl } from '../../core/config.js';

const classId = Number(queryParam('id') || 0);
let detail = null;

const studentsTable = createTable(qs('[data-class-students]'), {
    emptyTitle: 'Lớp chưa có học viên',
    emptyHint: 'Gán học viên vào lớp bằng nút "Gán học viên" ở phía trên.',
    emptyIcon: 'bi-person-plus',
    columns: [
        {
            label: 'Học viên',
            render: (row) => `
                <a class="class-name" href="../../students/detail/?id=${row.id}">${escapeHtml(row.full_name)}</a>
                <span class="fs-13 text-muted-2">${escapeHtml(row.student_code)}</span>`
        },
        { label: 'Ngày sinh', render: (row) => escapeHtml(date(row.dob)) },
        {
            label: 'Phụ huynh',
            render: (row) => row.guardian_name || row.guardian_phone
                ? `<span class="d-block">${escapeHtml(row.guardian_name || '—')}</span>
                   <span class="fs-13 text-muted-2">${escapeHtml(row.guardian_phone || '')}</span>`
                : '<span class="text-muted-2">—</span>'
        },
        {
            label: 'Trạng thái',
            render: (row) => {
                const meta = statusMeta('student', row.status);
                return `<span class="hk-badge hk-badge--${meta.tone}">${escapeHtml(meta.label)}</span>`;
            }
        },
        {
            label: 'Thao tác',
            headerClass: 'text-end',
            render: (row) => can('classes.assign')
                ? `<button type="button" class="btn btn-sm btn-light" data-transfer="${row.id}" data-name="${escapeHtml(row.full_name)}" title="Chuyển sang lớp khác"><i class="bi bi-arrow-left-right"></i></button>`
                : ''
        }
    ]
});

function renderHero(data) {
    const item = data.class || {};
    document.title = `${item.name} · HappyKidsCK`;
    const main = qs('[data-class-main]');
    if (main) {
        const status = item.status === 'active'
            ? '<span class="hk-badge hk-badge--success">Đang hoạt động</span>'
            : '<span class="hk-badge hk-badge--neutral">Đã ngừng</span>';
        main.innerHTML = `
            <h1 class="class-hero__name">${escapeHtml(item.name)}</h1>
            <div class="class-hero__meta">
                <span><i class="bi bi-geo-alt me-1"></i>${escapeHtml(item.branch_name || '—')}</span>
                <span><i class="bi bi-people me-1"></i>${number(item.student_count)} học viên</span>
                ${status}
                ${item.note ? `<span><i class="bi bi-sticky me-1"></i>${escapeHtml(item.note)}</span>` : ''}
            </div>`;
    }

    const countNode = qs('[data-student-count]');
    if (countNode) {
        countNode.textContent = `${number((data.students || []).length)} học viên`;
    }

    const actions = qs('[data-class-actions]');
    if (!actions) {
        return;
    }
    const buttons = [];
    if (can('classes.update')) {
        buttons.push(`<a class="btn-hk-outline" href="../form/?id=${item.id}"><i class="bi bi-pencil me-1"></i>Sửa lớp</a>`);
    }
    if (can('classes.assign') && item.status === 'active') {
        buttons.push('<button type="button" class="btn-hk" data-action="assign"><i class="bi bi-person-plus me-1"></i>Gán học viên</button>');
    }
    actions.innerHTML = buttons.join('');
}

function renderHistory(histories) {
    const host = qs('[data-class-history]');
    if (!host) {
        return;
    }
    if (!histories.length) {
        host.innerHTML = '<p class="text-muted-2 fs-13 mb-0">Chưa có lịch sử.</p>';
        return;
    }
    host.innerHTML = histories.map((item) => `
        <div class="history-item">
            <p class="history-item__title">${escapeHtml(item.full_name)} <span class="fs-13 text-muted-2">(${escapeHtml(item.student_code)})</span></p>
            <p class="history-item__meta">
                Vào ${escapeHtml(date(item.joined_at))} · ${item.left_at ? `Rời ${escapeHtml(date(item.left_at))}` : 'Đang học'}
            </p>
            ${item.reason ? `<p class="history-item__reason">${escapeHtml(item.reason)}</p>` : ''}
        </div>`).join('');
}

function render(data) {
    detail = data;
    renderHero(data);
    studentsTable.render(data.students || []);
    renderHistory(data.class_histories || []);
}

async function load() {
    try {
        const payload = await api.get(`/classes/${classId}`);
        render(payload?.data || {});
    } catch (error) {
        showToast(error.message || 'Không tải được thông tin lớp', 'danger');
        const main = qs('[data-class-main]');
        if (main) {
            main.innerHTML = `<p class="text-muted-2 mb-0">${escapeHtml(error.message || 'Không tải được thông tin lớp')}</p>`;
        }
    }
}

function openAssignModal() {
    const modal = createModal({ title: 'Gán học viên vào lớp', size: 'md' });
    const form = document.createElement('form');
    form.className = 'assign-form';
    form.innerHTML = `
        <div class="hk-field">
            <label class="form-label" for="assign-search">Tìm học viên trong cơ sở</label>
            <input class="form-control" id="assign-search" type="search" placeholder="Nhập tên, mã học viên hoặc SĐT phụ huynh..." autocomplete="off">
        </div>
        <div class="assign-results" data-assign-results>
            <p class="assign-results__hint">Nhập từ khoá để tìm học viên.</p>
        </div>
        <div class="hk-field">
            <label class="form-label" for="assign-reason">Lý do / ghi chú</label>
            <input class="form-control" id="assign-reason" type="text" maxlength="255" placeholder="Ví dụ: Xếp lớp đầu năm học">
        </div>
        <div class="hk-field">
            <label class="form-label" for="assign-date">Ngày hiệu lực</label>
            <input class="form-control" id="assign-date" type="date" value="${todayIso()}">
        </div>`;
    modal.setBody(form);

    const results = form.querySelector('[data-assign-results]');
    const search = form.querySelector('#assign-search');
    let selectedId = null;

    const runSearch = debounce(async (keyword) => {
        if (!keyword) {
            results.innerHTML = '<p class="assign-results__hint">Nhập từ khoá để tìm học viên.</p>';
            return;
        }
        results.innerHTML = '<p class="assign-results__hint"><span class="spinner-border spinner-border-sm me-2"></span>Đang tìm...</p>';
        try {
            const payload = await api.get('/students/search', { q: keyword });
            const students = payload?.data || [];
            if (!students.length) {
                results.innerHTML = '<p class="assign-results__hint">Không tìm thấy học viên phù hợp.</p>';
                return;
            }
            results.innerHTML = students.map((item) => `
                <button type="button" class="assign-result" data-student-id="${item.id}">
                    <span>${escapeHtml(item.full_name)}</span>
                    <span class="assign-result__code">${escapeHtml(item.student_code)}</span>
                </button>`).join('');
        } catch (error) {
            results.innerHTML = `<p class="assign-results__hint">${escapeHtml(error.message || 'Không tìm được học viên')}</p>`;
        }
    }, 350);

    search.addEventListener('input', () => runSearch(search.value.trim()));
    results.addEventListener('click', (event) => {
        const button = event.target.closest('[data-student-id]');
        if (!button) {
            return;
        }
        results.querySelectorAll('.assign-result').forEach((node) => node.classList.remove('is-selected'));
        button.classList.add('is-selected');
        selectedId = Number(button.dataset.studentId);
    });

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-hk-outline';
    cancel.textContent = 'Huỷ';
    cancel.dataset.bsDismiss = 'modal';

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn-hk';
    submit.textContent = 'Gán vào lớp';
    submit.addEventListener('click', async () => {
        if (!selectedId) {
            showToast('Vui lòng chọn học viên cần gán', 'warning');
            return;
        }
        setLoading(submit, true, 'Đang gán...');
        try {
            await api.post(`/classes/${classId}/assign`, {
                student_id: selectedId,
                reason: form.querySelector('#assign-reason').value.trim() || null,
                effective_date: form.querySelector('#assign-date').value || todayIso()
            });
            modal.hide();
            flash('Đã gán học viên vào lớp', 'success');
            load();
        } catch (error) {
            if (error.status === 422 && error.errors) {
                showFormErrors(form, error.errors);
            }
            showToast(error.message || 'Không gán được học viên', 'danger');
        } finally {
            setLoading(submit, false);
        }
    });

    modal.setFooter([cancel, submit]);
    modal.show();
    window.setTimeout(() => search.focus(), 250);
}

async function openTransferModal(studentId, studentName) {
    let classes = [];
    try {
        const payload = await api.get('/classes');
        classes = (payload?.data || []).filter((item) => item.status === 'active' && Number(item.id) !== classId);
    } catch (error) {
        showToast(error.message || 'Không tải được danh sách lớp', 'danger');
        return;
    }
    if (!classes.length) {
        showToast('Cơ sở chưa có lớp hoạt động khác để chuyển đến', 'warning');
        return;
    }

    const modal = createModal({ title: 'Chuyển lớp', size: 'sm' });
    const form = document.createElement('form');
    form.className = 'transfer-form';
    form.innerHTML = `
        <p class="fs-13 text-muted-2">Chuyển <strong>${escapeHtml(studentName)}</strong> sang lớp:</p>
        <div class="hk-field">
            <label class="form-label" for="target-class">Lớp đích <span class="text-danger">*</span></label>
            <select class="form-select" id="target-class" required>
                <option value="">Chọn lớp</option>
                ${classes.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}
            </select>
        </div>
        <div class="hk-field">
            <label class="form-label" for="transfer-reason">Lý do</label>
            <input class="form-control" id="transfer-reason" type="text" maxlength="255" placeholder="Ví dụ: Chuyển theo độ tuổi">
        </div>
        <div class="hk-field">
            <label class="form-label" for="transfer-date">Ngày hiệu lực</label>
            <input class="form-control" id="transfer-date" type="date" value="${todayIso()}">
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
    submit.textContent = 'Chuyển lớp';
    submit.addEventListener('click', async () => {
        const target = form.querySelector('#target-class');
        if (!target.value) {
            target.classList.add('is-invalid');
            return;
        }
        setLoading(submit, true, 'Đang chuyển...');
        try {
            await api.post('/classes/transfer', {
                student_id: studentId,
                class_id: Number(target.value),
                reason: form.querySelector('#transfer-reason').value.trim() || null,
                effective_date: form.querySelector('#transfer-date').value || todayIso()
            });
            modal.hide();
            flash('Đã chuyển học viên sang lớp mới', 'success');
            load();
        } catch (error) {
            showToast(error.message || 'Không chuyển được lớp', 'danger');
        } finally {
            setLoading(submit, false);
        }
    });

    modal.setFooter([cancel, submit]);
    modal.show();
}

qs('[data-class-actions]')?.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="assign"]')) {
        openAssignModal();
    }
});

qs('[data-class-students]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-transfer]');
    if (button) {
        openTransferModal(Number(button.dataset.transfer), button.dataset.name || '');
    }
});

document.addEventListener('hk:ready', () => {
    if (!classId) {
        showToast('Thiếu mã lớp học cần xem', 'warning');
        window.location.replace(pageUrl(PAGES.classes));
        return;
    }
    load();
});
