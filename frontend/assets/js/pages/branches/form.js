import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { can } from '../../core/auth.js';
import { flash } from '../../core/flash.js';
import { clearFormErrors, showFormErrors } from '../../core/form.js';
import { escapeHtml, qs, queryParam, setLoading } from '../../core/dom.js';
import { fileUrl, PAGES, pageUrl } from '../../core/config.js';

const form = qs('[data-branch-form]');
const submitButton = qs('[data-submit]');
const idParam = queryParam('id');
const editingId = idParam ? Number(idParam) : null;
let logoPath = null;

function setHint(text, isError = false) {
    const hint = qs('[data-form-hint]');
    if (!hint) {
        return;
    }
    hint.textContent = text || '';
    hint.classList.toggle('form-hint--error', Boolean(isError));
}

function renderLogo() {
    const node = qs('[data-logo]');
    if (!node) {
        return;
    }
    node.innerHTML = logoPath
        ? `<img src="${escapeHtml(fileUrl(logoPath))}" alt="Logo cơ sở">`
        : '<i class="bi bi-buildings"></i>';
}

function updateHeading() {
    if (!editingId) {
        return;
    }
    const title = qs('[data-page-title]');
    const subtitle = qs('[data-page-subtitle]');
    if (title) {
        title.textContent = 'Chỉnh sửa cơ sở';
        document.title = 'Chỉnh sửa cơ sở · HappyKidsCK';
    }
    if (subtitle) {
        subtitle.textContent = 'Cập nhật thông tin và trạng thái hoạt động của cơ sở';
    }
}

async function loadBranch() {
    try {
        const payload = await api.get('/branches');
        const branch = (payload?.data || []).find((item) => Number(item.id) === Number(editingId));
        if (!branch) {
            showToast('Không tìm thấy cơ sở cần chỉnh sửa', 'danger');
            window.location.replace(pageUrl(PAGES.branches));
            return;
        }
        form.elements.namedItem('code').value = branch.code || '';
        form.elements.namedItem('name').value = branch.name || '';
        form.elements.namedItem('address').value = branch.address || '';
        form.elements.namedItem('phone').value = branch.phone || '';
        form.elements.namedItem('status').value = branch.status || 'active';
        logoPath = branch.logo_path || null;
        renderLogo();
        qs('[data-status-field]')?.removeAttribute('hidden');
        qs('[data-logo-row]')?.removeAttribute('hidden');
    } catch (error) {
        showToast(error.message || 'Không tải được thông tin cơ sở', 'danger');
        setHint(error.message || 'Không tải được thông tin cơ sở', true);
    }
}

async function uploadLogo(file) {
    if (!file) {
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        showToast('Ảnh vượt quá 2MB, vui lòng chọn ảnh nhỏ hơn', 'warning');
        return;
    }
    const data = new FormData();
    data.append('logo', file);
    try {
        const response = await api.upload('POST', `/branches/${editingId}/logo`, data);
        logoPath = response?.data?.logo_path || logoPath;
        renderLogo();
        showToast('Đã cập nhật logo cơ sở', 'success');
    } catch (error) {
        showToast(error.message || 'Không cập nhật được logo', 'danger');
    }
}

async function submit(event) {
    event.preventDefault();
    clearFormErrors(form);
    const code = form.elements.namedItem('code').value.trim().toUpperCase();
    const name = form.elements.namedItem('name').value.trim();
    const address = form.elements.namedItem('address').value.trim();
    const phone = form.elements.namedItem('phone').value.trim();

    if (!code) {
        setHint('Vui lòng nhập mã cơ sở.', true);
        return;
    }
    if (!name) {
        setHint('Vui lòng nhập tên cơ sở.', true);
        return;
    }

    const payload = {
        code,
        name,
        address: address || null,
        phone: phone || null
    };
    if (editingId) {
        payload.status = form.elements.namedItem('status').value;
    }

    setLoading(submitButton, true, 'Đang lưu...');
    setHint('');
    try {
        if (editingId) {
            await api.put(`/branches/${editingId}`, payload);
            flash('Cập nhật cơ sở thành công', 'success');
        } else {
            await api.post('/branches', payload);
            flash('Thêm cơ sở thành công', 'success');
        }
        window.location.href = pageUrl(PAGES.branches);
    } catch (error) {
        if (error.status === 422 && error.errors) {
            showFormErrors(form, error.errors);
            setHint('Thông tin cơ sở chưa hợp lệ, vui lòng kiểm tra lại.', true);
        } else {
            setHint(error.message || 'Không lưu được cơ sở', true);
        }
        showToast(error.message || 'Không lưu được cơ sở', 'danger');
    } finally {
        setLoading(submitButton, false);
    }
}

document.addEventListener('hk:ready', async () => {
    if (!can('branches.manage')) {
        showToast('Bạn không có quyền quản lý cơ sở', 'danger');
        window.location.replace(pageUrl(PAGES.branches));
        return;
    }

    form.addEventListener('submit', submit);
    form.elements.namedItem('code').addEventListener('input', (event) => {
        event.target.value = event.target.value.toUpperCase();
    });
    qs('[data-logo-input]')?.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        uploadLogo(file);
    });

    updateHeading();
    if (editingId) {
        await loadBranch();
    }
});
