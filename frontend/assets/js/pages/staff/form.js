import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { can, session } from '../../core/auth.js';
import { flash } from '../../core/flash.js';
import { clearFormErrors, showFormErrors } from '../../core/form.js';
import { initials } from '../../core/format.js';
import { escapeHtml, qs, queryParam, setLoading } from '../../core/dom.js';
import { fileUrl, PAGES, pageUrl } from '../../core/config.js';

const form = qs('[data-staff-form]');
const submitButton = qs('[data-submit]');
const idParam = queryParam('id');
const editingId = idParam ? Number(idParam) : null;
let branches = [];
let avatarPath = null;
let permissionMeta = null;
let staffLoaded = !editingId;

const MODULE_LABELS = {
    students: 'Học viên',
    classes: 'Lớp học',
    attendance: 'Điểm danh',
    tuition: 'Học phí',
    staff: 'Nhân viên',
    branches: 'Cơ sở',
    reports: 'Báo cáo',
    logs: 'Nhật ký',
    settings: 'Cấu hình'
};

const MODULE_ORDER = ['students', 'classes', 'attendance', 'tuition', 'staff', 'branches', 'reports', 'logs', 'settings'];

function setHint(text, isError = false) {
    const hint = qs('[data-form-hint]');
    if (!hint) {
        return;
    }
    hint.textContent = text || '';
    hint.classList.toggle('form-hint--error', Boolean(isError));
}

function selectedRole() {
    return form.elements.namedItem('role_key')?.value || '';
}

function selectedBranchIds() {
    return Array.from(form.querySelectorAll('[name="branch_ids[]"]:checked')).map((input) => Number(input.value));
}

function isSuperRole() {
    return selectedRole() === 'super_admin';
}

function updateBranchHint() {
    const hint = qs('[data-branch-hint]');
    if (!hint) {
        return;
    }
    hint.textContent = isSuperRole()
        ? 'Quản trị hệ thống làm việc toàn hệ thống. Có thể để trống hoặc chọn các cơ sở thường dùng.'
        : 'Nhân viên chỉ truy cập được dữ liệu của cơ sở được chọn (tối đa 2 cơ sở).';
}

function isSuperActor() {
    return session.role?.key === 'super_admin';
}

function roleDefaults(roleKey) {
    const role = permissionMeta?.roles?.find((item) => item.key === roleKey);
    return new Set(role?.permission_keys || []);
}

function permissionInputs() {
    return Array.from(form.querySelectorAll('[name="permission_keys[]"]'));
}

function selectedPermissionKeys() {
    return permissionInputs().filter((input) => input.checked).map((input) => input.value);
}

function updatePermissionSummary() {
    const node = qs('[data-permission-summary]');
    if (!node || !permissionMeta) {
        return;
    }
    if (!selectedRole()) {
        node.textContent = 'Chọn vai trò để áp dụng quyền mặc định.';
        node.hidden = false;
        return;
    }
    const defaults = roleDefaults(selectedRole());
    const selected = new Set(selectedPermissionKeys());
    let extra = 0;
    selected.forEach((key) => {
        if (!defaults.has(key)) {
            extra += 1;
        }
    });
    let removed = 0;
    defaults.forEach((key) => {
        if (!selected.has(key)) {
            removed += 1;
        }
    });
    let text = `Đang bật ${selected.size}/${permissionMeta.permissions.length} quyền`;
    if (extra || removed) {
        const bits = [];
        if (extra) bits.push(`cấp thêm ${extra}`);
        if (removed) bits.push(`thu hồi ${removed}`);
        text += ` (${bits.join(', ')} so với vai trò)`;
    } else {
        text += ' — đúng mặc định của vai trò';
    }
    node.textContent = `${text}.`;
    node.hidden = false;
}

function applyPermissionKeys(keys) {
    const set = new Set(keys || []);
    permissionInputs().forEach((input) => {
        input.checked = set.has(input.value);
    });
    updatePermissionSummary();
}

function renderPermissionMatrix() {
    const grid = qs('[data-permission-grid]');
    if (!grid || !permissionMeta) {
        return;
    }
    const groups = new Map();
    permissionMeta.permissions.forEach((permission) => {
        if (!groups.has(permission.module)) {
            groups.set(permission.module, []);
        }
        groups.get(permission.module).push(permission);
    });
    const ordered = Array.from(groups.entries()).sort((a, b) => {
        const aIndex = MODULE_ORDER.indexOf(a[0]);
        const bIndex = MODULE_ORDER.indexOf(b[0]);
        return (aIndex === -1 ? MODULE_ORDER.length : aIndex) - (bIndex === -1 ? MODULE_ORDER.length : bIndex);
    });
    grid.innerHTML = ordered.map(([module, items]) => `
        <div class="permission-group">
            <p class="permission-group__title">${escapeHtml(MODULE_LABELS[module] || module)}</p>
            <div class="permission-group__items">
                ${items.map((permission) => `
                    <label class="permission-option">
                        <input type="checkbox" name="permission_keys[]" value="${escapeHtml(permission.key)}">
                        <span class="permission-option__label">${escapeHtml(permission.name)}</span>
                        <code class="permission-option__key">${escapeHtml(permission.key)}</code>
                    </label>`).join('')}
            </div>
        </div>`).join('');
}

function updatePermissionVisibility() {
    const card = qs('[data-permission-card]');
    if (!card) {
        return;
    }
    const role = selectedRole();
    const visible = isSuperActor() && Boolean(permissionMeta) && staffLoaded && Boolean(role) && role !== 'super_admin';
    card.hidden = !visible;
    if (visible) {
        updatePermissionSummary();
    }
}

function resetPermissionsToRole() {
    applyPermissionKeys(Array.from(roleDefaults(selectedRole())));
}

function onRoleChange() {
    updateBranchHint();
    if (isSuperActor() && permissionMeta) {
        resetPermissionsToRole();
        updatePermissionVisibility();
    }
}

async function loadPermissionMeta() {
    try {
        const payload = await api.get('/permissions');
        permissionMeta = payload?.data || null;
    } catch (error) {
        permissionMeta = null;
        showToast(error.message || 'Không tải được danh mục quyền', 'danger');
    }
    renderPermissionMatrix();
    updatePermissionVisibility();
}

function renderAvatar() {
    const node = qs('[data-avatar]');
    if (!node) {
        return;
    }
    if (avatarPath) {
        node.classList.remove('hk-avatar--fallback');
        node.innerHTML = `<img src="${escapeHtml(fileUrl(avatarPath))}" alt="Ảnh đại diện">`;
    } else {
        node.classList.add('hk-avatar--fallback');
        node.textContent = initials(form.elements.namedItem('full_name')?.value || '?');
    }
}

function renderBranches() {
    const picker = qs('[data-branch-picker]');
    if (!picker) {
        return;
    }
    if (!branches.length) {
        picker.innerHTML = '<p class="text-muted-2 fs-13 mb-0">Chưa có cơ sở nào.</p>';
        return;
    }
    picker.innerHTML = branches.map((branch) => `
        <label class="branch-option">
            <input type="checkbox" name="branch_ids[]" value="${branch.id}">
            <span>
                <span class="branch-option__name">${escapeHtml(branch.name)}</span>
                <span class="branch-option__meta">${escapeHtml(branch.code)}${branch.status === 'inactive' ? ' · ngừng hoạt động' : ''}</span>
            </span>
        </label>`).join('');
}

async function loadBranches() {
    try {
        const payload = await api.get('/branches');
        branches = payload?.data || [];
    } catch (error) {
        branches = [];
        showToast(error.message || 'Không tải được danh sách cơ sở', 'danger');
    }
    renderBranches();
}

function applyBranches(ids) {
    const set = new Set((ids || []).map(Number));
    form.querySelectorAll('[name="branch_ids[]"]').forEach((input) => {
        input.checked = set.has(Number(input.value));
    });
}

function updateHeading() {
    if (!editingId) {
        return;
    }
    const title = qs('[data-page-title]');
    const subtitle = qs('[data-page-subtitle]');
    if (title) {
        title.textContent = 'Chỉnh sửa nhân viên';
        document.title = 'Chỉnh sửa nhân viên · HappyKidsCK';
    }
    if (subtitle) {
        subtitle.textContent = 'Cập nhật thông tin, vai trò và cơ sở làm việc';
    }
}

async function loadStaff() {
    try {
        const payload = await api.get(`/staff/${editingId}`);
        const user = payload?.data?.user || {};
        form.elements.namedItem('full_name').value = user.full_name || '';
        form.elements.namedItem('username').value = user.username || '';
        form.elements.namedItem('email').value = user.email || '';
        form.elements.namedItem('phone').value = user.phone || '';
        form.elements.namedItem('role_key').value = user.role_key || '';
        avatarPath = user.avatar_path || null;
        applyBranches(payload?.data?.branch_ids || []);
        if (isSuperActor()) {
            applyPermissionKeys(payload?.data?.permission_keys || []);
        }
        updatePermissionVisibility();
        renderAvatar();
        qs('[data-avatar-row]')?.removeAttribute('hidden');

        const usernameInput = form.elements.namedItem('username');
        usernameInput.readOnly = true;
        qs('[data-username-required]')?.setAttribute('hidden', '');
        qs('[data-password-field]')?.setAttribute('hidden', '');
        form.elements.namedItem('password')?.removeAttribute('required');

        if (Number(editingId) === Number(session.user?.id)) {
            form.elements.namedItem('role_key').disabled = true;
            setHint('Không thể tự thay đổi vai trò của chính mình.', false);
        }
        staffLoaded = true;
        updateBranchHint();
        updatePermissionVisibility();
    } catch (error) {
        showToast(error.message || 'Không tải được hồ sơ nhân viên', 'danger');
        setHint(error.message || 'Không tải được hồ sơ nhân viên', true);
    }
}

async function uploadAvatar(file) {
    if (!file) {
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        showToast('Ảnh vượt quá 2MB, vui lòng chọn ảnh nhỏ hơn', 'warning');
        return;
    }
    const data = new FormData();
    data.append('avatar', file);
    try {
        const response = await api.upload('POST', `/staff/${editingId}/avatar`, data);
        avatarPath = response?.data?.avatar_path || avatarPath;
        renderAvatar();
        showToast('Đã cập nhật ảnh đại diện', 'success');
    } catch (error) {
        showToast(error.message || 'Không cập nhật được ảnh đại diện', 'danger');
    }
}

async function submit(event) {
    event.preventDefault();
    clearFormErrors(form);
    const branchError = qs('[data-branch-error]');
    if (branchError) {
        branchError.hidden = true;
        branchError.textContent = '';
    }

    const fullName = form.elements.namedItem('full_name').value.trim();
    const username = form.elements.namedItem('username').value.trim();
    const password = form.elements.namedItem('password')?.value || '';
    const roleKey = selectedRole();
    const email = form.elements.namedItem('email').value.trim();
    const phone = form.elements.namedItem('phone').value.trim();
    const branchIds = selectedBranchIds();

    if (!fullName) {
        setHint('Vui lòng nhập họ tên nhân viên.', true);
        return;
    }
    if (!editingId) {
        if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
            setHint('Tên đăng nhập 3-50 ký tự, chỉ gồm chữ, số và . _ -', true);
            return;
        }
        if (password.length < 8) {
            setHint('Mật khẩu tối thiểu 8 ký tự.', true);
            return;
        }
    }
    if (!roleKey) {
        setHint('Vui lòng chọn vai trò.', true);
        return;
    }
    if (roleKey !== 'super_admin') {
        if (branchIds.length === 0) {
            if (branchError) {
                branchError.hidden = false;
                branchError.textContent = 'Vui lòng chọn ít nhất một cơ sở cho nhân viên.';
            }
            return;
        }
        if (branchIds.length > 2) {
            if (branchError) {
                branchError.hidden = false;
                branchError.textContent = 'Mỗi nhân viên chỉ được phân công tối đa 2 cơ sở.';
            }
            return;
        }
    }

    const payload = {
        full_name: fullName,
        email: email || null,
        phone: phone || null,
        role_key: roleKey,
        branch_ids: branchIds
    };
    const permissionCard = qs('[data-permission-card]');
    if (isSuperActor() && permissionCard && !permissionCard.hidden) {
        payload.permission_keys = selectedPermissionKeys();
    }
    if (!editingId) {
        payload.username = username;
        payload.password = password;
    }

    setLoading(submitButton, true, 'Đang lưu...');
    setHint('');
    try {
        if (editingId) {
            await api.put(`/staff/${editingId}`, payload);
            flash('Cập nhật nhân viên thành công', 'success');
        } else {
            await api.post('/staff', payload);
            flash('Thêm nhân viên thành công', 'success');
        }
        window.location.href = pageUrl(PAGES.staff);
    } catch (error) {
        if (error.status === 422 && error.errors) {
            showFormErrors(form, error.errors);
            if (error.errors.branch_ids && branchError) {
                branchError.hidden = false;
                branchError.textContent = Array.isArray(error.errors.branch_ids)
                    ? error.errors.branch_ids.join(' ')
                    : String(error.errors.branch_ids);
            }
            setHint('Thông tin nhân viên chưa hợp lệ, vui lòng kiểm tra lại.', true);
        } else {
            setHint(error.message || 'Không lưu được nhân viên', true);
        }
        showToast(error.message || 'Không lưu được nhân viên', 'danger');
    } finally {
        setLoading(submitButton, false);
    }
}

document.addEventListener('hk:ready', async () => {
    if (!can('staff.manage')) {
        showToast('Bạn không có quyền quản lý nhân viên', 'danger');
        window.location.replace(pageUrl(PAGES.staff));
        return;
    }

    if (session.role?.key !== 'super_admin') {
        qs('[data-super-option]')?.remove();
    }

    form.addEventListener('submit', submit);
    form.elements.namedItem('role_key').addEventListener('change', onRoleChange);
    form.elements.namedItem('full_name').addEventListener('input', () => {
        if (!avatarPath) {
            renderAvatar();
        }
    });

    qs('[data-permission-reset]')?.addEventListener('click', () => {
        if (!isSuperActor() || !permissionMeta) {
            return;
        }
        resetPermissionsToRole();
    });

    form.addEventListener('change', (event) => {
        if (event.target.matches('[name="permission_keys[]"]')) {
            updatePermissionSummary();
        }
        if (event.target.matches('[name="branch_ids[]"]') && !isSuperRole()) {
            if (selectedBranchIds().length > 2) {
                event.target.checked = false;
                showToast('Mỗi nhân viên chỉ được phân công tối đa 2 cơ sở', 'warning');
            }
        }
    });

    qs('[data-avatar-input]')?.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        uploadAvatar(file);
    });

    updateHeading();
    if (isSuperActor()) {
        await loadPermissionMeta();
    }
    await loadBranches();
    if (editingId) {
        await loadStaff();
    }
});
