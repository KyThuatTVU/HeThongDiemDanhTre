import { session, logout, selectBranch, currentBranch } from '../../assets/js/core/auth.js';
import { fileUrl } from '../../assets/js/core/config.js';
import { labels, initials, weekdayLabel, todayIso } from '../../assets/js/core/format.js';
import { qs, qsa, escapeHtml } from '../../assets/js/core/dom.js';
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

    const shell = document.querySelector('.app-shell');
    const toggleBtn = qs('[data-action="toggle-sidebar"]', root);
    const toggleIcon = qs('[data-sidebar-toggle-icon]', root);
    const SIDEBAR_KEY = 'hk_sidebar_collapsed';

    function syncSidebarToggleUi() {
        const isDesktop = window.innerWidth >= 992;
        const collapsed = Boolean(shell?.classList.contains('sidebar-collapsed'));
        if (toggleIcon) {
            toggleIcon.className = isDesktop
                ? (collapsed ? 'bi bi-layout-sidebar' : 'bi bi-layout-sidebar-inset')
                : 'bi bi-list';
        }
        if (toggleBtn) {
            const label = isDesktop
                ? (collapsed ? 'Mở thanh menu' : 'Thu gọn thanh menu để xem rộng hơn')
                : 'Mở menu';
            toggleBtn.title = label;
            toggleBtn.setAttribute('aria-label', label);
            toggleBtn.setAttribute('aria-expanded', isDesktop ? String(!collapsed) : String(Boolean(shell?.classList.contains('sidebar-open'))));
        }
    }

    if (shell && localStorage.getItem(SIDEBAR_KEY) === '1') {
        shell.classList.add('sidebar-collapsed');
    }
    syncSidebarToggleUi();

    toggleBtn?.addEventListener('click', () => {
        if (!shell) {
            return;
        }
        if (window.innerWidth >= 992) {
            const collapsed = shell.classList.toggle('sidebar-collapsed');
            localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
        } else {
            shell.classList.toggle('sidebar-open');
        }
        syncSidebarToggleUi();
    });

    window.addEventListener('resize', syncSidebarToggleUi);

    qsa('[data-action="logout"]', root).forEach((btn) => {
        btn.addEventListener('click', () => {
            logout();
        });
    });
}
