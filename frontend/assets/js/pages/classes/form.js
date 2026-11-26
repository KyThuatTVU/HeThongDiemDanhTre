import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { can } from '../../core/auth.js';
import { flash } from '../../core/flash.js';
import { clearFormErrors, showFormErrors } from '../../core/form.js';
import { qs, queryParam, setLoading } from '../../core/dom.js';
import { PAGES, pageUrl } from '../../core/config.js';

const form = qs('[data-class-form]');
const submitButton = qs('[data-submit]');
const idParam = queryParam('id');
const editingId = idParam ? Number(idParam) : null;
const statusField = qs('[data-status-field]');

function setHint(text, isError = false) {
    const hint = qs('[data-form-hint]');
    if (!hint) {
        return;
    }
    hint.textContent = text || '';
    hint.classList.toggle('form-hint--error', Boolean(isError));
}

async function loadClass() {
    try {
        const payload = await api.get(`/classes/${editingId}`);
        const item = payload?.data?.class || {};
        form.elements.namedItem('name').value = item.name || '';
        form.elements.namedItem('note').value = item.note || '';
        form.elements.namedItem('status').value = item.status || 'active';
        statusField.removeAttribute('hidden');
        const title = qs('[data-page-title]');
        const subtitle = qs('[data-page-subtitle]');
        if (title) {
            title.textContent = 'Chỉnh sửa lớp học';
            document.title = 'Chỉnh sửa lớp học · HappyKidsCK';
        }
        if (subtitle) {
            subtitle.textContent = `${item.branch_name || ''} · ${item.student_count ?? 0} học viên`;
        }
    } catch (error) {
        showToast(error.message || 'Không tải được thông tin lớp', 'danger');
        setHint(error.message || 'Không tải được thông tin lớp', true);
    }
}

async function submit(event) {
    event.preventDefault();
    clearFormErrors(form);
    if (!form.reportValidity()) {
        setHint('Vui lòng nhập tên lớp.', true);
        return;
    }
    const name = form.elements.namedItem('name').value.trim();
    const note = form.elements.namedItem('note').value.trim();
    const payload = { name, note: note === '' ? null : note };

    setLoading(submitButton, true, 'Đang lưu...');
    setHint('');
    try {
        let response;
        if (editingId) {
            payload.status = form.elements.namedItem('status').value;
            response = await api.put(`/classes/${editingId}`, payload);
            flash('Cập nhật lớp học thành công', 'success');
            window.location.href = pageUrl(`${PAGES.classDetail}?id=${editingId}`);
        } else {
            response = await api.post('/classes', payload);
            const newId = response?.data?.class?.id;
            flash('Thêm lớp học thành công', 'success');
            window.location.href = newId ? pageUrl(`${PAGES.classDetail}?id=${newId}`) : pageUrl(PAGES.classes);
        }
    } catch (error) {
        if (error.status === 422 && error.errors) {
            showFormErrors(form, error.errors);
            setHint('Thông tin lớp chưa hợp lệ, vui lòng kiểm tra lại.', true);
        } else {
            setHint(error.message || 'Không lưu được lớp học', true);
        }
        showToast(error.message || 'Không lưu được lớp học', 'danger');
    } finally {
        setLoading(submitButton, false);
    }
}

document.addEventListener('hk:ready', async () => {
    if (!editingId && !can('classes.create')) {
        showToast('Bạn không có quyền thêm lớp học', 'danger');
        window.location.replace(pageUrl(PAGES.classes));
        return;
    }
    if (editingId && !can('classes.update')) {
        showToast('Bạn không có quyền chỉnh sửa lớp học', 'danger');
        window.location.replace(pageUrl(`${PAGES.classDetail}?id=${editingId}`));
        return;
    }
    form.addEventListener('submit', submit);
    if (editingId) {
        await loadClass();
    }
});
