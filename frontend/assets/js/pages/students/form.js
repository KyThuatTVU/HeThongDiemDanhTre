import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { can, session } from '../../core/auth.js';
import { flash } from '../../core/flash.js';
import { clearFormErrors, showFormErrors } from '../../core/form.js';
import { escapeHtml, qs, queryParam, setLoading } from '../../core/dom.js';
import { PAGES, pageUrl } from '../../core/config.js';

const form = qs('[data-student-form]');
const submitButton = qs('[data-submit]');
const idParam = queryParam('id');
const editingId = idParam ? Number(idParam) : null;
const classField = qs('[data-class-field]');
const classSelect = qs('#class_id');

function setHint(text, isError = false) {
    const hint = qs('[data-form-hint]');
    if (!hint) {
        return;
    }
    hint.textContent = text || '';
    hint.classList.toggle('form-hint--error', Boolean(isError));
}

function updateHeading() {
    if (!editingId) {
        return;
    }
    const title = qs('[data-page-title]');
    const subtitle = qs('[data-page-subtitle]');
    if (title) {
        title.textContent = 'Chỉnh sửa học viên';
        document.title = 'Chỉnh sửa học viên · HappyKidsCK';
    }
    if (subtitle) {
        subtitle.textContent = 'Cập nhật thông tin hồ sơ học viên';
    }
}

function fillBranchChip() {
    const chip = qs('[data-branch-chip]');
    const branch = session.branches.find((item) => Number(item.id) === Number(session.currentBranchId));
    if (chip && branch) {
        chip.textContent = branch.name;
    }
}

async function loadClasses() {
    const mayAssign = editingId ? can('classes.assign') : true;
    if (!classField || !classSelect || !can('classes.view') || !mayAssign) {
        classField?.setAttribute('hidden', '');
        return;
    }
    try {
        const payload = await api.get('/classes');
        const classes = payload?.data || [];
        classSelect.insertAdjacentHTML('beforeend', classes.map((item) =>
            `<option value="${item.id}"${item.status === 'inactive' ? ' disabled' : ''}>${escapeHtml(item.name)}${item.status === 'inactive' ? ' (ngừng)' : ''}</option>`
        ).join(''));
        classField.removeAttribute('hidden');
    } catch {
        classField.setAttribute('hidden', '');
    }
}

function fillForm(student) {
    const textFields = ['student_code', 'full_name', 'study_format', 'guardian_name', 'guardian_phone', 'address', 'identity_code', 'notes'];
    textFields.forEach((field) => {
        const input = form.elements.namedItem(field);
        if (input) {
            input.value = student[field] ?? '';
        }
    });
    if (form.elements.namedItem('dob')) {
        form.elements.namedItem('dob').value = student.dob ? String(student.dob).slice(0, 10) : '';
    }
    if (form.elements.namedItem('enrollment_date')) {
        form.elements.namedItem('enrollment_date').value = student.enrollment_date ? String(student.enrollment_date).slice(0, 10) : '';
    }
    if (form.elements.namedItem('gender')) {
        form.elements.namedItem('gender').value = student.gender || '';
    }
    if (form.elements.namedItem('status')) {
        form.elements.namedItem('status').value = student.status || 'active';
    }
    if (form.elements.namedItem('monthly_fee')) {
        form.elements.namedItem('monthly_fee').value = Number(student.monthly_fee || 0);
    }
    if (classSelect) {
        classSelect.value = student.current_class_id ? String(student.current_class_id) : '';
    }
    if (student.deleted_at) {
        setHint('Học viên đang bị xoá, cần khôi phục trước khi chỉnh sửa.', true);
        submitButton?.setAttribute('disabled', '');
    }
}

async function loadStudent() {
    try {
        const payload = await api.get(`/students/${editingId}`);
        fillForm(payload?.data?.student || {});
        updateHeading();
    } catch (error) {
        showToast(error.message || 'Không tải được hồ sơ học viên', 'danger');
        setHint(error.message || 'Không tải được hồ sơ học viên', true);
    }
}

function buildPayload() {
    const data = new FormData(form);
    const payload = {};
    const read = (key) => {
        const value = data.get(key);
        return typeof value === 'string' ? value.trim() : '';
    };

    payload.full_name = read('full_name');
    payload.student_code = read('student_code');
    payload.status = read('status') || 'active';

    const nullable = ['dob', 'gender', 'study_format', 'guardian_name', 'guardian_phone', 'address', 'enrollment_date', 'notes', 'identity_code'];
    nullable.forEach((key) => {
        const value = read(key);
        payload[key] = value === '' ? null : value;
    });

    const fee = read('monthly_fee');
    payload.monthly_fee = fee === '' ? 0 : Number(fee);

    if (classField && !classField.hidden) {
        const classId = read('class_id');
        payload.class_id = classId === '' ? null : Number(classId);
    }
    return payload;
}

async function submit(event) {
    event.preventDefault();
    clearFormErrors(form);

    if (!form.reportValidity()) {
        setHint('Vui lòng điền các trường bắt buộc.', true);
        return;
    }

    const payload = buildPayload();
    setLoading(submitButton, true, 'Đang lưu...');
    setHint('');
    try {
        const response = editingId
            ? await api.put(`/students/${editingId}`, payload)
            : await api.post('/students', payload);
        const savedId = response?.data?.student?.id ?? editingId;
        flash(editingId ? 'Cập nhật hồ sơ học viên thành công' : 'Thêm học viên thành công', 'success');
        window.location.href = savedId ? pageUrl(`${PAGES.studentDetail}?id=${savedId}`) : pageUrl(PAGES.students);
    } catch (error) {
        if (error.status === 422 && error.errors) {
            showFormErrors(form, error.errors);
            setHint('Một số trường chưa hợp lệ, vui lòng kiểm tra lại.', true);
        } else {
            setHint(error.message || 'Không lưu được hồ sơ', true);
        }
        showToast(error.message || 'Không lưu được hồ sơ học viên', 'danger');
    } finally {
        setLoading(submitButton, false);
    }
}

document.addEventListener('hk:ready', async () => {
    if (!editingId && !can('students.create')) {
        showToast('Bạn không có quyền thêm học viên', 'danger');
        window.location.replace(pageUrl(PAGES.students));
        return;
    }
    if (editingId && !can('students.update')) {
        showToast('Bạn không có quyền chỉnh sửa hồ sơ học viên', 'danger');
        window.location.replace(pageUrl(`${PAGES.studentDetail}?id=${editingId}`));
        return;
    }

    fillBranchChip();
    form.addEventListener('submit', submit);

    await loadClasses();
    if (editingId) {
        await loadStudent();
    }
});
