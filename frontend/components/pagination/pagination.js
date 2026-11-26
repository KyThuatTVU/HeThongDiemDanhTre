import { injectCss } from '../../assets/js/core/dom.js';

injectCss(new URL('./pagination.css', import.meta.url).href, 'component-pagination');

function pageWindow(current, totalPages) {
    const pages = [];
    const push = (page) => {
        if (!pages.includes(page) && page >= 1 && page <= totalPages) {
            pages.push(page);
        }
    };
    push(1);
    for (let page = current - 1; page <= current + 1; page += 1) {
        push(page);
    }
    push(totalPages);

    const result = [];
    let previous = 0;
    pages.sort((a, b) => a - b).forEach((page) => {
        if (page - previous > 1) {
            result.push('…');
        }
        result.push(page);
        previous = page;
    });
    return result;
}

export function renderPagination(container, meta, onChange) {
    if (!container) {
        return;
    }
    const total = Number(meta?.total || 0);
    const perPage = Number(meta?.per_page || 0);
    const current = Number(meta?.page || 1);
    const totalPages = Number(meta?.total_pages || (perPage ? Math.ceil(total / perPage) : 0));

    if (!total || totalPages <= 1) {
        container.hidden = true;
        container.innerHTML = '';
        return;
    }
    container.hidden = false;

    const from = (current - 1) * perPage + 1;
    const to = Math.min(current * perPage, total);

    const buttons = [
        `<button type="button" class="page-link" data-page="${current - 1}"${current <= 1 ? ' disabled' : ''} aria-label="Trang trước"><i class="bi bi-chevron-left"></i></button>`,
        ...pageWindow(current, totalPages).map((item) => {
            if (item === '…') {
                return '<span class="page-link disabled">…</span>';
            }
            return `<button type="button" class="page-link" data-page="${item}"${item === current ? ' aria-current="page"' : ''}>${item}</button>`;
        }),
        `<button type="button" class="page-link" data-page="${current + 1}"${current >= totalPages ? ' disabled' : ''} aria-label="Trang sau"><i class="bi bi-chevron-right"></i></button>`
    ];

    container.innerHTML = `
        <span class="hk-pagination__info">Hiển thị ${from}–${to} / ${total} bản ghi</span>
        <ul class="pagination">
            ${buttons.map((html, index) => {
                const active = html.includes('aria-current="page"');
                return `<li class="page-item${active ? ' active' : ''}">${html}</li>`;
            }).join('')}
        </ul>`;

    container.querySelectorAll('.page-link[data-page]').forEach((button) => {
        if (button.disabled) {
            return;
        }
        button.addEventListener('click', () => {
            const page = Number(button.dataset.page);
            if (page >= 1 && page <= totalPages && page !== current) {
                onChange(page);
            }
        });
    });
}
