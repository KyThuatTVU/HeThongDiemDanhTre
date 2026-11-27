import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { can } from '../../core/auth.js';
import { number } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

let classes = [];
let keyword = '';
let status = '';

const table = createTable(qs('[data-classes-table]'), {
    emptyTitle: 'Chưa có lớp học',
    emptyHint: 'Tạo lớp đầu tiên để bắt đầu xếp lớp cho học viên.',
    emptyIcon: 'bi-diagram-3',
    columns: [
        {
            label: 'Lớp',
            render: (row) => `
                <a class="class-name" href="../detail/?id=${row.id}">${escapeHtml(row.name)}</a>
                ${row.note ? `<span class="fs-13 text-muted-2">${escapeHtml(row.note)}</span>` : ''}`
        },
        {
            label: 'Học viên',
            render: (row) => `<span class="class-count"><i class="bi bi-people"></i>${number(row.student_count)}</span>`
        },
        {
            label: 'Trạng thái',
            mobileHide: true,
            render: (row) => row.status === 'active'
                ? '<span class="hk-badge hk-badge--success">Đang hoạt động</span>'
                : '<span class="hk-badge hk-badge--neutral">Đã ngừng</span>'
        },
        {
            label: 'Thao tác',
            headerClass: 'text-end',
            className: 'text-end',
            render: (row) => {
                const buttons = [`<a class="btn btn-sm btn-light" href="../detail/?id=${row.id}" title="Xem lớp"><i class="bi bi-eye"></i><span class="hk-mobile-only ms-1">Chi tiết</span></a>`];
                if (can('classes.update')) {
                    buttons.push(`<a class="btn btn-sm btn-light hk-desktop-only" href="../form/?id=${row.id}" title="Chỉnh sửa"><i class="bi bi-pencil"></i></a>`);
                }
                return `<div class="d-inline-flex gap-1">${buttons.join('')}</div>`;
            }
        }
    ]
});

function applyFilter() {
    let rows = classes;
    if (keyword) {
        const needle = keyword.toLowerCase();
        rows = rows.filter((item) =>
            String(item.name).toLowerCase().includes(needle) || String(item.note || '').toLowerCase().includes(needle)
        );
    }
    if (status) {
        rows = rows.filter((item) => item.status === status);
    }
    table.render(rows);
}

async function load() {
    table.setLoading();
    try {
        const payload = await api.get('/classes');
        classes = payload?.data || [];
        applyFilter();
    } catch (error) {
        table.setError(error.message || 'Không tải được danh sách lớp');
        showToast(error.message || 'Không tải được danh sách lớp', 'danger');
    }
}

document.addEventListener('hk:toolbar-search', (event) => {
    keyword = event.detail?.value || '';
    applyFilter();
});

document.addEventListener('hk:toolbar-submit', (event) => {
    event.preventDefault();
});

document.addEventListener('hk:ready', () => {
    qs('[data-filter-status]')?.addEventListener('change', (event) => {
        status = event.target.value;
        applyFilter();
    });
    load();
});
