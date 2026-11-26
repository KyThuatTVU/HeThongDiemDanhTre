import { escapeHtml } from '../../assets/js/core/dom.js';

export function init(root) {
    const title = root.dataset.title || '';
    const subtitle = root.dataset.subtitle || '';
    const crumbs = root.dataset.breadcrumb || '';

    const titleNode = root.querySelector('[data-page-title]');
    if (titleNode) {
        titleNode.textContent = title;
        if (title) {
            document.title = `${title} · HappyKidsCK`;
        }
    }

    const subtitleNode = root.querySelector('[data-page-subtitle]');
    if (subtitleNode) {
        subtitleNode.textContent = subtitle;
        subtitleNode.hidden = !subtitle;
    }

    const crumbNode = root.querySelector('[data-page-breadcrumb]');
    if (crumbNode) {
        let items = [];
        try {
            items = crumbs ? JSON.parse(crumbs) : [];
        } catch {
            items = [];
        }
        if (!items.length && !title) {
            crumbNode.hidden = true;
            return;
        }
        const arrow = '<i class="bi bi-chevron-right"></i>';
        const parts = ['<a href="../../../pages/dashboard/overview/">Tổng quan</a>'];
        items.forEach((item) => {
            parts.push(arrow);
            if (item.href) {
                parts.push(`<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`);
            } else {
                parts.push(`<span>${escapeHtml(item.label)}</span>`);
            }
        });
        parts.push(arrow, `<span aria-current="page">${escapeHtml(title || 'Trang')}</span>`);
        crumbNode.innerHTML = parts.join('');
    }
}
