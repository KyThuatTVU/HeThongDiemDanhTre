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
        const homeLink = '<a href="../../../pages/dashboard/overview/">Tổng quan</a>';
        const parts = items.length ? [homeLink] : ['<span aria-current="page">Tổng quan</span>'];
        const currentLabel = title || 'Trang';
        const lastItem = items[items.length - 1];
        const lastIsCurrent = !lastItem || lastItem.label === currentLabel;

        items.forEach((item, index) => {
            parts.push(arrow);
            const isCurrent = index === items.length - 1 && lastIsCurrent;
            if (isCurrent) {
                parts.push(`<span aria-current="page">${escapeHtml(item.label)}</span>`);
            } else if (item.href) {
                parts.push(`<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`);
            } else {
                parts.push(`<span>${escapeHtml(item.label)}</span>`);
            }
        });

        if (!lastIsCurrent) {
            parts.push(arrow, `<span aria-current="page">${escapeHtml(currentLabel)}</span>`);
        }
        crumbNode.innerHTML = parts.join('');

        const current = crumbNode.querySelector('[aria-current="page"]');
        if (current && titleNode) {
            const syncCurrent = () => {
                const next = titleNode.textContent.trim();
                if (next && current.textContent !== next) {
                    current.textContent = next;
                }
            };
            new MutationObserver(syncCurrent).observe(titleNode, { childList: true, characterData: true, subtree: true });
        }
    }
}
