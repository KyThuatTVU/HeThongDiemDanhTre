import { session, logout, selectBranch, currentBranch } from '../../assets/js/core/auth.js';
import { fileUrl } from '../../assets/js/core/config.js';
import { labels, initials, weekdayLabel, todayIso } from '../../assets/js/core/format.js';
import { qs, escapeHtml } from '../../assets/js/core/dom.js';
import { showToast } from '../toast/toast.js';

function greetingText() {
    const hour = new Date().getHours();
    if (hour < 11) {
        return 'Chào buổi sáng';
    }
    if (hour < 14) {
        return 'Chào buổi trưa';
    }
    if (hour < 18) {
        return 'Chào buổi chiều';
    }
    return 'Chào buổi tối';
}

function renderAvatar(target, user) {
    if (!target || !user) {
        return;
    }
    const avatarUrl = fileUrl(user.avatar_path);
    if (avatarUrl) {
        target.classList.remove('hk-avatar--fallback');
        target.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(user.full_name || '')}">`;
    } else {
        target.textContent = initials(user.full_name);
    }
}

export function init(root) {
    qs('[data-topbar-greeting]', root).textContent = greetingText();
    const today = todayIso();
    qs('[data-topbar-date]', root).textContent = `${weekdayLabel(today)}, ${today.split('-').reverse().join('/')}`;

    const user = session.user;
    if (user) {
        qs('[data-topbar-name]', root).textContent = user.full_name || user.username || 'Tài khoản';
        qs('[data-topbar-role]', root).textContent = labels.role(session.role?.key);
        renderAvatar(qs('[data-topbar-avatar]', root), user);
    }

    const select = qs('[data-branch-select]', root);
    if (select) {
        select.innerHTML = session.branches.map((branch) => {
            const selected = Number(branch.id) === Number(session.currentBranchId) ? ' selected' : '';
            return `<option value="${branch.id}"${selected}>${escapeHtml(branch.name)}</option>`;
        }).join('');
        if (session.branches.length < 2) {
            select.disabled = true;
        }
        select.addEventListener('change', async () => {
            const target = Number(select.value);
            if (target === Number(session.currentBranchId)) {
                return;
            }
            select.disabled = true;
            try {
                await selectBranch(target);
                window.location.reload();
            } catch (error) {
                select.value = String(currentBranch()?.id ?? session.currentBranchId ?? '');
                select.disabled = false;
                showToast(error.message || 'Không đổi được cơ sở làm việc', 'danger');
            }
        });
    }

    qs('[data-action="toggle-sidebar"]', root)?.addEventListener('click', () => {
        document.querySelector('.app-shell')?.classList.toggle('sidebar-open');
    });

    qs('[data-action="logout"]', root)?.addEventListener('click', () => {
        logout();
    });
}
