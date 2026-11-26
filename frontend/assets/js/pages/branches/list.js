import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { createTable } from '../../../../components/data-table/data-table.js';
import { can } from '../../core/auth.js';
import { escapeHtml, qs } from '../../core/dom.js';
import { fileUrl } from '../../core/config.js';

let branches = [];
let keyword = '';

const table = createTable(qs('[data-branches-table]'), {
    emptyTitle: 'Chưa có cơ sở',
    emptyHint: 'Thêm cơ sở mới hoặc thay đổi từ khoá tìm kiếm.',
    emptyIcon: 'bi-buildings',
    columns: [
        {
            label: 'Cơ sở',
            render: (row) => `
                <div class="branch-cell">
                    <span class="branch-logo">
                        ${row.logo_path
                            ? `<img src="${escapeHtml(fileUrl(row.logo_path))}" alt="Logo ${escapeHtml(row.name)}">`
                            : '<i class="bi bi-buildings"></i>'}
                    </span>
                    <span>
                        <span class="branch-cell__name">${escapeHtml(row.name)}</span>
                        <span class="branch-cell__meta">${escapeHtml(row.code)}</span>
                    </span>
                </div>`
        },
        {
            label: 'Địa chỉ',
            render: (row) => row.address
                ? escapeHtml(row.address)
                : '<span class="text-muted-2">—</span>'
        },
        {
            label: 'Điện thoại',
            render: (row) => row.phone
                ? escapeHtml(row.phone)
                : '<span class="text-muted-2">—</span>'
        },
        {
            label: 'Trạng thái',
            render: (row) => row.status === 'active'
                ? '<span class="hk-badge hk-badge--success">Đang hoạt động</span>'
                : '<span class="hk-badge hk-badge--neutral">Ngừng hoạt động</span>'
        },
        {
            label: 'Thao tác',
            headerClass: 'text-end',
            render: (row) => can('branches.manage')
                ? `<a class="btn btn-sm btn-light" href="../form/?id=${row.id}" title="Chỉnh sửa"><i class="bi bi-pencil"></i></a>`
                : '<span class="text-muted-2">—</span>'
        }
    ]
});

function filtered() {
    if (!keyword) {
        return branches;
    }
    const needle = keyword.toLowerCase();
    return branches.filter((row) => [row.name, row.code, row.address, row.phone]
        .some((value) => String(value || '').toLowerCase().includes(needle)));
}

function renderRows() {
    table.render(filtered());
}

async function load() {
    table.setLoading();
    try {
        const payload = await api.get('/branches');
        branches = payload?.data || [];
        renderRows();
    } catch (error) {
        table.setError(error.message || 'Không tải được danh sách cơ sở');
        showToast(error.message || 'Không tải được danh sách cơ sở', 'danger');
    }
}

document.addEventListener('hk:toolbar-search', (event) => {
    keyword = (event.detail?.value || '').trim();
    renderRows();
});

document.addEventListener('hk:toolbar-submit', (event) => {
    event.preventDefault();
});

document.addEventListener('hk:ready', load);
