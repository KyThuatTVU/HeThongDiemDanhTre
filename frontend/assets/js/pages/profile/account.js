import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { session } from '../../core/auth.js';
import { flash } from '../../core/flash.js';
import { clearFormErrors, showFormErrors } from '../../core/form.js';
import { datetime, initials, statusMeta } from '../../core/format.js';
import { escapeHtml, qs, setLoading } from '../../core/dom.js';
import { fileUrl } from '../../core/config.js';

const profileForm = qs('[data-profile-form]');
const passwordForm = qs('[data-password-form]');

function profileHint(text, isError = false) {
    const hint = qs('[data-profile-hint]');
    if (!hint) {
        return;
    }
    hint.textContent = text || '';
    hint.classList.toggle('form-hint--error', Boolean(isError));
}

function passwordHint(text, isError = false) {
    const hint = qs('[data-password-hint]');
    if (!hint) {
        return;
    }
    hint.textContent = text || '';
    hint.classList.toggle('form-hint--error', Boolean(isError));
}

function renderAvatar(user) {
    const node = qs('[data-avatar]');
    if (!node) {
        return;
    }
    if (user.avatar_path) {
        node.classList.remove('hk-avatar--fallback');
        node.innerHTML = `<img src="${escapeHtml(fileUrl(user.avatar_path))}" alt="${escapeHtml(user.full_name || 'Ảnh đại diện')}">`;
    } else {
        node.classList.add('hk-avatar--fallback');
        node.textContent = initials(user.full_name || '?');
    }
}

function renderAccountInfo() {
    const user = session.user || {};
    const status = statusMeta('user', user.status);
    const branches = (session.branches || []).map((branch) => branch.name).join(', ') || 'Toàn hệ thống';
    const host = qs('[data-account-info]');
    if (!host) {
        return;
    }
    host.innerHTML = `
        <dt>Tên đăng nhập</dt><dd>${escapeHtml(user.username || '—')}</dd>
        <dt>Email</dt><dd>${escapeHtml(user.email || '—')}</dd>
        <dt>Vai trò</dt><dd>${escapeHtml(session.role?.name || '—')}</dd>
        <dt>Cơ sở làm việc</dt><dd>${escapeHtml(branches)}</dd>
        <dt>Trạng thái</dt><dd><span class="hk-badge hk-badge--${status.tone}">${escapeHtml(status.label)}</span></dd>
        <dt>Đăng nhập cuối</dt><dd>${escapeHtml(datetime(user.last_login_at))}</dd>`;
}

function fillProfile() {
    const user = session.user || {};
    const nameNode = qs('[data-profile-name]');
    const roleNode = qs('[data-profile-role]');
    const usernameNode = qs('[data-profile-username]');
    const branchesNode = qs('[data-profile-branches]');

    if (nameNode) {
        nameNode.textContent = user.full_name || '—';
    }
    if (roleNode) {
        roleNode.textContent = session.role?.name || '—';
    }
    if (usernameNode) {
        usernameNode.textContent = `@${user.username || ''}`;
    }
    if (branchesNode) {
        const names = (session.branches || []).map((branch) => branch.name).join(' · ');
        branchesNode.textContent = names || 'Toàn hệ thống';
    }

    profileForm.elements.namedItem('full_name').value = user.full_name || '';
    profileForm.elements.namedItem('phone').value = user.phone || '';

    renderAvatar(user);
    renderAccountInfo();
}

async function saveProfile(event) {
    event.preventDefault();
    clearFormErrors(profileForm);
    profileHint('');

    const fullName = profileForm.elements.namedItem('full_name').value.trim();
    const phone = profileForm.elements.namedItem('phone').value.trim();
    if (!fullName) {
        profileHint('Vui lòng nhập họ và tên.', true);
        return;
    }

    const button = qs('[data-profile-submit]');
    setLoading(button, true, 'Đang lưu...');
    try {
        await api.put('/profile', { full_name: fullName, phone: phone || null });
        flash('Đã cập nhật thông tin cá nhân', 'success');
        window.location.reload();
    } catch (error) {
        if (error.status === 422 && error.errors) {
            showFormErrors(profileForm, error.errors);
        }
        profileHint(error.message || 'Không lưu được thông tin', true);
        showToast(error.message || 'Không lưu được thông tin', 'danger');
        setLoading(button, false);
    }
}

async function changePassword(event) {
    event.preventDefault();
    clearFormErrors(passwordForm);
    passwordHint('');

    const current = passwordForm.elements.namedItem('current_password').value;
    const next = passwordForm.elements.namedItem('new_password').value;
    const confirm = passwordForm.elements.namedItem('new_password_confirmation').value;

    if (!current) {
        passwordHint('Vui lòng nhập mật khẩu hiện tại.', true);
        return;
    }
    if (next.length < 10 || !/\p{L}/u.test(next) || !/\p{N}/u.test(next)) {
        passwordHint('Mật khẩu mới tối thiểu 10 ký tự, gồm chữ và số.', true);
        return;
    }
    if (next !== confirm) {
        passwordHint('Xác nhận mật khẩu không khớp.', true);
        return;
    }

    const button = qs('[data-password-submit]');
    setLoading(button, true, 'Đang xử lý...');
    try {
        await api.put('/profile/password', {
            current_password: current,
            new_password: next,
            new_password_confirmation: confirm
        });
        passwordForm.reset();
        passwordHint('Đã đổi mật khẩu thành công.');
        showToast('Đã đổi mật khẩu thành công', 'success');
    } catch (error) {
        if (error.status === 422 && error.errors) {
            showFormErrors(passwordForm, error.errors);
        }
        passwordHint(error.message || 'Không đổi được mật khẩu', true);
        showToast(error.message || 'Không đổi được mật khẩu', 'danger');
    } finally {
        setLoading(button, false);
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
        await api.upload('POST', '/profile/avatar', data);
        flash('Đã cập nhật ảnh đại diện', 'success');
        window.location.reload();
    } catch (error) {
        showToast(error.message || 'Không cập nhật được ảnh đại diện', 'danger');
    }
}

document.addEventListener('hk:ready', () => {
    fillProfile();
    profileForm.addEventListener('submit', saveProfile);
    passwordForm.addEventListener('submit', changePassword);
    qs('[data-avatar-input]')?.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        uploadAvatar(file);
    });
});
