import { injectCss, escapeHtml } from '../../assets/js/core/dom.js';

injectCss(new URL('./data-table.css', import.meta.url).href, 'component-data-table');
injectCss(new URL('../empty-state/empty-state.css', import.meta.url).href, 'component-empty-state');

export function createTable(container, options = {}) {
    const columns = options.columns || [];
    const emptyTitle = options.emptyTitle || 'Chưa có dữ liệu';
    const emptyHint = options.emptyHint || '';

    const wrap = document.createElement('div');
    wrap.className = 'hk-table-wrap';
    wrap.innerHTML = `
        <div class="table-responsive">
            <table class="table hk-table align-middle">
                <thead><tr></tr></thead>
                <tbody></tbody>
            </table>
        </div>`;

    const theadRow = wrap.querySelector('thead tr');
    theadRow.innerHTML = columns.map((column) => {
        const width = column.width ? ` style="width:${escapeHtml(column.width)}"` : '';
        const className = column.headerClass ? ` class="${escapeHtml(column.headerClass)}"` : '';
        return `<th${className}${width}>${escapeHtml(column.label || '')}</th>`;
    }).join('');

    const tbody = wrap.querySelector('tbody');
    container.replaceChildren(wrap);

    function renderEmpty() {
        tbody.innerHTML = `<tr><td colspan="${columns.length}">
            <div class="hk-empty hk-empty--table">
                <div class="hk-empty__icon"><i class="bi ${escapeHtml(options.emptyIcon || 'bi-inbox')}"></i></div>
                <h3 class="hk-empty__title">${escapeHtml(emptyTitle)}</h3>
                ${emptyHint ? `<p class="hk-empty__hint">${escapeHtml(emptyHint)}</p>` : ''}
            </div>
        </td></tr>`;
    }

    function render(rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
            renderEmpty();
            return;
        }
        tbody.innerHTML = rows.map((row, index) => {
            const rowClass = typeof options.rowClass === 'function' ? options.rowClass(row) : '';
            const cells = columns.map((column) => {
                const value = typeof column.render === 'function'
                    ? column.render(row, index)
                    : escapeHtml(row[column.key] ?? '—');
                const className = column.className ? ` class="${escapeHtml(column.className)}"` : '';
                return `<td${className}>${value ?? ''}</td>`;
            }).join('');
            return `<tr${rowClass ? ` class="${escapeHtml(rowClass)}"` : ''}>${cells}</tr>`;
        }).join('');
    }

    function setLoading(message = 'Đang tải dữ liệu...') {
        tbody.innerHTML = `<tr><td colspan="${columns.length}" class="hk-table__loading">
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${escapeHtml(message)}
        </td></tr>`;
    }

    function setError(message = 'Không tải được dữ liệu') {
        tbody.innerHTML = `<tr><td colspan="${columns.length}" class="hk-table__error">
            <i class="bi bi-exclamation-triangle me-1"></i>${escapeHtml(message)}
        </td></tr>`;
    }

    setLoading();

    return {
        element: wrap,
        tbody,
        columns,
        render,
        renderEmpty,
        setLoading,
        setError
    };
}
