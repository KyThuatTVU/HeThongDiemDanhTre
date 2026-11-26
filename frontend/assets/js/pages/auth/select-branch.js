import { session, selectBranch, logout } from '../../core/auth.js';
import { DASHBOARD_URL, fileUrl } from '../../core/config.js';
import { escapeHtml, qs } from '../../core/dom.js';

const list = qs('[data-branch-list]');
const empty = qs('[data-branch-empty]');

function logoHtml(branch) {
    const url = fileUrl(branch.logo_path);
    if (url) {
        return `<img class="branch-card__logo" src="${escapeHtml(url)}" alt="Logo ${escapeHtml(branch.name)}">`;
    }
    return `<span class="branch-card__logo">${escapeHtml(String(branch.code || branch.name).slice(0, 2).toUpperCase())}</span>`;
}

function renderBranches() {
    const branches = session.branches || [];
    if (!branches.length) {
        list.innerHTML = '';
        empty.hidden = false;
        return;
    }
    list.innerHTML = branches.map((branch) => {
        const current = Number(branch.id) === Number(session.currentBranchId);
        return `
            <button type="button" class="branch-card" data-branch-id="${branch.id}">
                ${logoHtml(branch)}
                <span class="branch-card__body">
                    <span class="branch-card__name">${escapeHtml(branch.name)}</span>
                    <span class="branch-card__meta">${escapeHtml(branch.code || '')}${branch.address ? ' · ' + escapeHtml(branch.address) : ''}</span>
                </span>
                ${current ? '<span class="branch-card__current">Đang chọn</span>' : '<i class="bi bi-chevron-right text-muted-2"></i>'}
            </button>`;
    }).join('');
}

list.addEventListener('click', async (event) => {
    const card = event.target.closest('[data-branch-id]');
    if (!card) {
        return;
    }
    card.disabled = true;
    try {
        await selectBranch(Number(card.dataset.branchId));
        window.location.replace(DASHBOARD_URL);
    } catch (error) {
        alert(error.message || 'Không chọn được cơ sở');
        card.disabled = false;
    }
});

qs('[data-action="logout-link"]')?.addEventListener('click', (event) => {
    event.preventDefault();
    logout();
});

// app.js đã tải phiên đăng nhập trước khi phát hk:ready
document.addEventListener('hk:ready', renderBranches);
