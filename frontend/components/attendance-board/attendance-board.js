import { api } from '../../assets/js/core/http.js';
import { can, currentBranch, session } from '../../assets/js/core/auth.js';
import { createTable } from '../data-table/data-table.js';
import { confirmAction } from '../modal/modal.js';
import { showToast } from '../toast/toast.js';
import { date, datetime, number, todayIso } from '../../assets/js/core/format.js';
import { escapeHtml, qs, qsa, setLoading } from '../../assets/js/core/dom.js';

const STATUS_PILLS = [
    { value: 'present', label: 'Có mặt', short: '✓', icon: 'bi-check-lg', tone: 'success' },
    { value: 'late', label: 'Đi trễ', short: 'M', icon: 'bi-clock', tone: 'warning' },
    { value: 'excused_absent', label: 'Vắng phép', short: 'P', icon: '', tone: 'info' },
    { value: 'unexcused_absent', label: 'Vắng KP', short: 'K', icon: '', tone: 'danger' },
    { value: 'planned_leave', label: 'Nghỉ báo', short: 'N', icon: '', tone: 'neutral' }
];

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .trim();
}

function rowToneClass(status) {
    if (status === 'present') return 'att-row--present';
    if (status === 'late') return 'att-row--late';
    if (status) return 'att-row--absent';
    return '';
}

const DRAFT_PREFIX = 'hk_att_draft:';
const DRAFT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

function cleanupOldDrafts() {
    try {
        const now = Date.now();
        for (let i = localStorage.length - 1; i >= 0; i -= 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(DRAFT_PREFIX)) continue;
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : null;
            if (!parsed || !parsed.savedAt || (now - Number(parsed.savedAt)) > DRAFT_MAX_AGE_MS) {
                localStorage.removeItem(key);
            }
        }
    } catch {
        // Bỏ qua lỗi storage
    }
}

export function init(root) {
    cleanupOldDrafts();
    const state = {
        classes: [],
        classFilter: '', // '' = tất cả, 'unassigned' = chưa xếp lớp, '<id>' = lớp cụ thể
        search: '',
        date: todayIso(),
        slot: 'Chính',
        branchName: '',
        allRows: [],
        sessions: [],
        loading: false,
        saving: false,
        lastSavedAt: null
    };
    let requestSeq = 0;

    const boardSection = qs('[data-att-board]', root);
    const classTabsHost = qs('[data-att-class-tabs]', root);
    const searchInput = qs('[data-att-search]', root);
    const filterToggle = qs('[data-att-filter-toggle]', root);
    const filterExtras = qs('[data-att-filter-extras]', root);
    const compactBtn = qs('[data-att-compact]', root);
    const classSelect = qs('[data-att-class]', root);
    const dateInput = qs('[data-att-date]', root);
    const slotInput = qs('[data-att-slot]', root);
    const loadButton = qs('[data-att-load]', root);
    const titleNode = qs('[data-att-title]', root);
    const subtitleNode = qs('[data-att-subtitle]', root);
    const banner = qs('[data-att-banner]', root);
    const lockStatus = qs('[data-att-lock-status]', root);
    const lockActions = qs('[data-att-lock-actions]', root);
    const saveBars = qsa('[data-att-savebar]', root);
    const saveButtons = qsa('[data-att-save]', root);
    const markAllButtons = qsa('[data-att-mark-all]', root);
    const tableHost = qs('[data-att-table]', root);

    function canEditRow(row) {
        return can('attendance.save') && (!row.is_locked || can('attendance.edit'));
    }

    function visibleRows() {
        const keyword = normalizeText(state.search);
        return state.allRows.filter((row) => {
            if (state.classFilter === 'unassigned') {
                if (row.class_id !== null) return false;
            } else if (state.classFilter !== '') {
                if (String(row.class_id ?? '') !== state.classFilter) return false;
            }
            if (keyword) {
                const haystack = normalizeText(`${row.full_name} ${row.student_code} ${row.class_name || 'chưa xếp lớp'}`);
                if (!haystack.includes(keyword)) return false;
            }
            return true;
        });
    }

    function currentFilterLabel() {
        if (state.classFilter === 'unassigned') {
            return 'Chưa xếp lớp';
        }
        if (state.classFilter !== '') {
            const matched = state.classes.find((item) => String(item.id) === state.classFilter);
            return matched ? matched.name : 'Lớp đã chọn';
        }
        return 'Tất cả học viên';
    }

    function activeSessionForFilter() {
        if (state.classFilter === 'unassigned') {
            return state.sessions.find((s) => s.class_id === null) || null;
        }
        if (state.classFilter !== '') {
            return state.sessions.find((s) => String(s.class_id ?? '') === state.classFilter) || null;
        }
        return null;
    }

    const table = createTable(tableHost, {
        emptyTitle: 'Không có học viên phù hợp',
        emptyHint: 'Thử chọn "Tất cả học viên" hoặc xoá từ khoá tìm kiếm.',
        emptyIcon: 'bi-people',
        rowClass: (row) => rowToneClass(row.status),
        columns: [
            {
                label: 'STT',
                width: '48px',
                headerClass: 'text-center',
                className: 'att-stt',
                render: (_row, index) => String(index + 1)
            },
            {
                label: 'Học viên',
                render: (row) => `<span class="att-student-name">${escapeHtml(row.full_name)}</span>
                    <span class="fs-13 text-muted-2">${escapeHtml(row.student_code)}</span>`
            },
            {
                label: 'Lớp',
                render: (row) => row.class_name
                    ? `<span class="att-class-tag">${escapeHtml(row.class_name)}</span>`
                    : '<span class="att-class-tag att-class-tag--empty">Chưa xếp lớp</span>'
            },
            {
                label: 'Điểm danh (bấm để tích chọn)',
                render: (row) => {
                    const editable = canEditRow(row);
                    const buttons = STATUS_PILLS.map((pill) => {
                        const active = row.status === pill.value;
                        const icon = pill.icon ? `<i class="bi ${pill.icon} att-pill__full"></i>` : '';
                        return `<button type="button"
                            class="att-pill att-pill--${pill.tone}${active ? ' is-active' : ''}"
                            data-pick-student="${row.student_id}"
                            data-pick-status="${pill.value}"
                            title="${pill.label}"
                            aria-pressed="${active ? 'true' : 'false'}"${editable ? '' : ' disabled'}>
                            ${icon}<span class="att-pill__full">${pill.label}</span><span class="att-pill__short">${pill.short}</span>
                        </button>`;
                    }).join('');
                    return `<div class="att-pills" data-pills-for="${row.student_id}">${buttons}</div>`;
                }
            },
            {
                label: 'Ghi chú',
                render: (row) => `<input type="text" class="form-control form-control-sm att-note"
                    maxlength="255" placeholder="Lý do / ghi chú..." value="${escapeHtml(row.note || '')}"
                    data-note-for="${row.student_id}"${canEditRow(row) ? '' : ' disabled'}>`
            }
        ]
    });

    function updateSummary() {
        const rows = visibleRows();
        let present = 0;
        let absent = 0;
        let unrecorded = 0;
        rows.forEach((row) => {
            if (!row.status) {
                unrecorded += 1;
            } else if (row.status === 'present' || row.status === 'late') {
                present += 1;
            } else {
                absent += 1;
            }
        });
        qsa('[data-att-total]', root).forEach((node) => { node.textContent = number(rows.length); });
        qsa('[data-att-present]', root).forEach((node) => { node.textContent = number(present); });
        qsa('[data-att-absent]', root).forEach((node) => { node.textContent = number(absent); });
        qsa('[data-att-unrecorded]', root).forEach((node) => { node.textContent = number(unrecorded); });
    }

    function isPerClassDefaultBranch() {
        return String(currentBranch()?.code || '').toUpperCase() === 'CL';
    }

    function syncSheetLinks() {
        document.querySelectorAll('a[href*="attendance-sheet"], a[href*="/attendance/sheet"]').forEach((anchor) => {
            const url = new URL(anchor.getAttribute('href'), window.location.href);
            if (state.classFilter) {
                url.searchParams.set('class_id', state.classFilter);
            } else {
                url.searchParams.delete('class_id');
            }
            anchor.setAttribute('href', `${url.pathname}${url.search}`);
        });
    }

    function syncUrl() {
        const url = new URL(window.location.href);
        if (state.classFilter) {
            url.searchParams.set('class_id', state.classFilter);
        } else {
            url.searchParams.delete('class_id');
        }
        url.searchParams.set('date', state.date);
        url.searchParams.set('slot', state.slot);
        window.history.replaceState(null, '', url);
        syncSheetLinks();
    }

    function renderHeaderAndLock() {
        const isAllView = state.classFilter === '';
        const session = activeSessionForFilter();
        const totalSessions = state.sessions.length;
        const lockedCount = state.sessions.filter((s) => s.is_locked).length;
        const allLocked = totalSessions > 0 && lockedCount === totalSessions;
        const anyLocked = lockedCount > 0;

        if (lockStatus && lockActions) {
            if (isAllView) {
                if (totalSessions === 0) {
                    lockStatus.innerHTML = '<span class="hk-chip">Chưa lưu sổ</span>';
                    lockActions.innerHTML = '';
                } else if (allLocked) {
                    lockStatus.innerHTML = `<span class="hk-chip text-danger"><i class="bi bi-lock-fill me-1"></i>Đã khoá (${lockedCount}/${totalSessions})</span>`;
                    lockActions.innerHTML = can('attendance.lock')
                        ? '<button type="button" class="btn-hk-outline btn-sm" data-lock-day="unlock"><i class="bi bi-unlock me-1"></i>Mở khoá tất cả</button>'
                        : '';
                } else if (anyLocked) {
                    lockStatus.innerHTML = `<span class="hk-chip text-warning"><i class="bi bi-lock me-1"></i>Khoá một phần (${lockedCount}/${totalSessions})</span>`;
                    lockActions.innerHTML = can('attendance.lock')
                        ? '<button type="button" class="btn-hk-outline btn-sm" data-lock-day="lock"><i class="bi bi-lock me-1"></i>Khoá tất cả</button>'
                          + '<button type="button" class="btn-hk-outline btn-sm" data-lock-day="unlock"><i class="bi bi-unlock me-1"></i>Mở khoá</button>'
                        : '';
                } else {
                    lockStatus.innerHTML = '<span class="hk-chip text-success"><i class="bi bi-unlock me-1"></i>Đang mở</span>';
                    lockActions.innerHTML = can('attendance.lock')
                        ? '<button type="button" class="btn-hk-outline btn-sm" data-lock-day="lock"><i class="bi bi-lock me-1"></i>Khoá sổ ngày này</button>'
                        : '';
                }
            } else {
                if (!session) {
                    lockStatus.innerHTML = '<span class="hk-chip">Chưa lưu sổ</span>';
                    lockActions.innerHTML = '';
                } else if (session.is_locked) {
                    lockStatus.innerHTML = `<span class="hk-chip text-danger"><i class="bi bi-lock-fill me-1"></i>Đã khoá · ${escapeHtml(datetime(session.locked_at))}</span>`;
                    lockActions.innerHTML = can('attendance.lock')
                        ? `<button type="button" class="btn-hk-outline btn-sm" data-lock-session="${session.id}" data-lock-action="unlock"><i class="bi bi-unlock me-1"></i>Mở khoá</button>`
                        : '';
                } else {
                    lockStatus.innerHTML = '<span class="hk-chip text-success"><i class="bi bi-unlock me-1"></i>Đang mở</span>';
                    lockActions.innerHTML = can('attendance.lock')
                        ? `<button type="button" class="btn-hk-outline btn-sm" data-lock-session="${session.id}" data-lock-action="lock"><i class="bi bi-lock me-1"></i>Khoá sổ</button>`
                        : '';
                }
            }
        }

        const rows = visibleRows();
        const hasEditableRow = rows.some((row) => canEditRow(row));
        const hasAnyEditableOverall = state.allRows.some((row) => canEditRow(row));
        saveBars.forEach((bar) => {
            bar.hidden = !can('attendance.save');
        });
        saveButtons.forEach((btn) => {
            btn.disabled = !hasAnyEditableOverall;
        });
        markAllButtons.forEach((btn) => {
            btn.disabled = !hasEditableRow;
        });

        if (banner) {
            const lockedInView = isAllView ? anyLocked : Boolean(session?.is_locked);
            if (lockedInView) {
                banner.hidden = false;
                banner.classList.toggle('att-banner--info', can('attendance.edit'));
                banner.innerHTML = can('attendance.edit')
                    ? '<i class="bi bi-info-circle me-1"></i>Sổ điểm danh đã khoá. Bạn có quyền chỉnh sửa nên vẫn có thể cập nhật và lưu lại.'
                    : '<i class="bi bi-lock me-1"></i>Một số hoặc toàn bộ sổ điểm danh đã khoá. Liên hệ quản lý cơ sở nếu cần điều chỉnh.';
            } else {
                banner.hidden = true;
            }
        }

        if (titleNode) {
            titleNode.textContent = `${currentFilterLabel()} · ${date(state.date)}`;
        }
        if (subtitleNode) {
            const parts = [`Ca ${state.slot}`];
            if (state.branchName) {
                parts.push(state.branchName);
            }
            if (state.lastSavedAt) {
                const hh = String(state.lastSavedAt.getHours()).padStart(2, '0');
                const mm = String(state.lastSavedAt.getMinutes()).padStart(2, '0');
                parts.push(`Đã lưu an toàn lúc ${hh}:${mm}`);
            }
            subtitleNode.textContent = parts.join(' · ');
            subtitleNode.hidden = false;
        }
    }

    function renderView() {
        table.render(visibleRows());
        renderHeaderAndLock();
        updateSummary();
        syncUrl();
    }

    function draftKey() {
        const userId = session.user?.id || '0';
        const branchId = session.currentBranchId || currentBranch()?.id || '0';
        return `${DRAFT_PREFIX}u${userId}:b${branchId}:${state.date}:${state.slot}`;
    }

    function dirtyCount() {
        let count = 0;
        state.allRows.forEach((row) => {
            if (!canEditRow(row)) return;
            const statusChanged = (row.status || null) !== (row.initial_status || null);
            const noteChanged = (row.note || '').trim() !== (row.initial_note || '').trim();
            if (statusChanged || noteChanged) {
                count += 1;
            }
        });
        return count;
    }

    function syncSaveButtonBadge() {
        const count = dirtyCount();
        saveButtons.forEach((btn) => {
            if (btn.dataset.loading === 'true') return;
            const isMobileCompact = Boolean(btn.closest('.att-mobile-bar'));
            const baseLabel = isMobileCompact ? 'Lưu' : 'Lưu điểm danh';
            btn.innerHTML = count > 0
                ? `<i class="bi bi-save me-1"></i>${baseLabel} (${count})`
                : `<i class="bi bi-save me-1"></i>${baseLabel}`;
        });
    }

    function persistDraft() {
        const changes = {};
        state.allRows.forEach((row) => {
            if (!canEditRow(row)) return;
            const statusChanged = (row.status || null) !== (row.initial_status || null);
            const noteChanged = (row.note || '').trim() !== (row.initial_note || '').trim();
            if (statusChanged || noteChanged) {
                changes[row.student_id] = {
                    status: row.status || null,
                    note: row.note || ''
                };
            }
        });
        try {
            if (Object.keys(changes).length === 0) {
                localStorage.removeItem(draftKey());
            } else {
                localStorage.setItem(draftKey(), JSON.stringify({
                    savedAt: Date.now(),
                    changes
                }));
            }
        } catch {
            // Bỏ qua nếu trình duyệt chặn storage
        }
        syncSaveButtonBadge();
    }

    function clearDraft() {
        try {
            localStorage.removeItem(draftKey());
        } catch {
            // Bỏ qua
        }
        syncSaveButtonBadge();
    }

    function parseServerTimestamp(value) {
        if (!value) return 0;
        const ts = Date.parse(String(value).replace(' ', 'T'));
        return Number.isFinite(ts) ? ts : 0;
    }

    function restoreDraftIfAny() {
        try {
            const raw = localStorage.getItem(draftKey());
            if (!raw) return 0;
            const parsed = JSON.parse(raw);
            const changes = parsed?.changes;
            const savedAt = Number(parsed?.savedAt || 0);
            if (!changes || typeof changes !== 'object') return 0;
            let restored = 0;
            state.allRows.forEach((row) => {
                if (!canEditRow(row)) return;
                const entry = changes[String(row.student_id)];
                if (!entry) return;
                // Không ghi đè nếu máy chủ đã có dữ liệu mới hơn bản nháp trên máy
                const serverTs = parseServerTimestamp(row.recorded_at);
                if (row.initial_status && serverTs > 0 && savedAt > 0 && serverTs > savedAt) {
                    return;
                }
                row.status = entry.status || null;
                row.note = entry.note || '';
                restored += 1;
            });
            return restored;
        } catch {
            return 0;
        }
    }

    function applyBoard(data) {
        state.branchName = data.class?.branch_name || '';
        state.sessions = data.sessions || [];
        state.allRows = (data.students || []).map((row) => ({
            student_id: Number(row.student_id),
            student_code: row.student_code,
            full_name: row.full_name,
            class_id: row.class_id !== null && row.class_id !== undefined ? Number(row.class_id) : null,
            class_name: row.class_name || null,
            guardian_name: row.guardian_name,
            guardian_phone: row.guardian_phone,
            status: row.status || null,
            initial_status: row.status || null,
            note: row.note || '',
            initial_note: row.note || '',
            recorded_at: row.recorded_at || null,
            is_locked: Boolean(row.is_locked)
        }));
        const restored = restoreDraftIfAny();
        renderClassOptions();
        renderView();
        syncSaveButtonBadge();
        if (restored > 0) {
            showToast(`Đã khôi phục ${restored} mục điểm danh chưa kịp lưu. Nhớ bấm Lưu điểm danh nhé!`, 'info');
        }
    }

    function renderClassTabs(countByClass, unassignedCount) {
        if (!classTabsHost) {
            return;
        }
        const items = [];
        const classItems = state.classes.map((item) => ({
            value: String(item.id),
            label: `${item.name}${item.status === 'inactive' ? ' (ngừng)' : ''}`,
            count: countByClass.get(Number(item.id)) ?? item.student_count ?? 0
        }));
        const allItem = {
            value: '',
            label: 'Tất cả học viên',
            count: state.allRows.length
        };

        if (isPerClassDefaultBranch()) {
            items.push(...classItems);
            if (unassignedCount > 0 || state.classFilter === 'unassigned') {
                items.push({ value: 'unassigned', label: 'Chưa xếp lớp', count: unassignedCount });
            }
            items.push(allItem);
        } else {
            items.push(allItem, ...classItems);
            if (unassignedCount > 0 || state.classFilter === 'unassigned') {
                items.push({ value: 'unassigned', label: 'Chưa xếp lớp', count: unassignedCount });
            }
        }

        if (items.length <= 1) {
            classTabsHost.hidden = true;
            classTabsHost.innerHTML = '';
            return;
        }

        classTabsHost.hidden = false;
        classTabsHost.innerHTML = items.map((tab) => {
            const active = tab.value === state.classFilter;
            return `<button type="button" class="att-class-tab${active ? ' is-active' : ''}"
                data-class-tab="${escapeHtml(tab.value)}" aria-pressed="${active ? 'true' : 'false'}">
                <span>${escapeHtml(tab.label)}</span>
                <span class="att-class-tab__count">${number(tab.count)}</span>
            </button>`;
        }).join('');
    }

    function renderClassOptions() {
        const unassignedCount = state.allRows.filter((row) => row.class_id === null).length;
        const countByClass = new Map();
        state.allRows.forEach((row) => {
            if (row.class_id !== null) {
                countByClass.set(row.class_id, (countByClass.get(row.class_id) || 0) + 1);
            }
        });

        const validValues = new Set(['', 'unassigned', ...state.classes.map((item) => String(item.id))]);
        if (!validValues.has(state.classFilter)) {
            state.classFilter = '';
        }

        if (classSelect) {
            const options = [
                `<option value="">Tất cả học viên (${state.allRows.length})</option>`
            ];
            state.classes.forEach((item) => {
                const count = countByClass.get(Number(item.id)) ?? item.student_count ?? 0;
                options.push(
                    `<option value="${item.id}">${escapeHtml(item.name)} (${count})${item.status === 'inactive' ? ' - ngừng' : ''}</option>`
                );
            });
            if (unassignedCount > 0 || state.classFilter === 'unassigned') {
                options.push(`<option value="unassigned">Chưa xếp lớp (${unassignedCount})</option>`);
            }

            classSelect.innerHTML = options.join('');
            classSelect.value = state.classFilter;
        }

        renderClassTabs(countByClass, unassignedCount);
    }

    async function loadBoard() {
        const seq = ++requestSeq;
        state.loading = true;
        table.setLoading();
        if (titleNode) {
            titleNode.textContent = 'Đang tải danh sách điểm danh...';
        }
        try {
            const payload = await api.get('/attendance/board', {
                session_date: state.date,
                slot_name: state.slot
            });
            if (seq !== requestSeq) {
                return;
            }
            applyBoard(payload?.data || {});
        } catch (error) {
            if (seq !== requestSeq) {
                return;
            }
            table.setError(error.message || 'Không tải được sổ điểm danh');
            showToast(error.message || 'Không tải được sổ điểm danh', 'danger');
        } finally {
            if (seq === requestSeq) {
                state.loading = false;
            }
        }
    }

    async function initBoard() {
        const params = new URLSearchParams(window.location.search);
        const initialDate = params.get('date');
        if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
            state.date = initialDate;
        }
        const initialSlot = (params.get('slot') || '').trim();
        if (initialSlot) {
            state.slot = initialSlot;
        }
        const initialClass = (params.get('class_id') || '').trim();
        const hasExplicitClass = params.has('class_id');
        if (initialClass === 'unassigned' || initialClass === '0') {
            state.classFilter = 'unassigned';
        } else if (/^\d+$/.test(initialClass)) {
            state.classFilter = initialClass;
        } else {
            state.classFilter = '';
        }

        if (dateInput) dateInput.value = state.date;
        if (slotInput) slotInput.value = state.slot;

        if (can('classes.view')) {
            try {
                const payload = await api.get('/classes');
                state.classes = payload?.data || [];
            } catch {
                state.classes = [];
            }
        }

        // Cơ sở Càng Long: mặc định mở theo từng lớp riêng (chọn lớp đầu tiên)
        if (!hasExplicitClass && isPerClassDefaultBranch() && state.classes.length > 0) {
            state.classFilter = String(state.classes[0].id);
        }

        await loadBoard();
    }

    const COMPACT_KEY = 'hk_att_compact';

    function applyCompact(enabled) {
        boardSection?.classList.toggle('is-compact', enabled);
        if (compactBtn) {
            compactBtn.classList.toggle('is-active', enabled);
            compactBtn.setAttribute('aria-pressed', String(enabled));
            compactBtn.innerHTML = enabled
                ? '<i class="bi bi-arrows-angle-expand me-1"></i><span>Đầy đủ</span>'
                : '<i class="bi bi-arrows-angle-contract me-1"></i><span>Xem gọn</span>';
        }
    }

    applyCompact(localStorage.getItem(COMPACT_KEY) === '1');

    compactBtn?.addEventListener('click', () => {
        const next = !boardSection?.classList.contains('is-compact');
        localStorage.setItem(COMPACT_KEY, next ? '1' : '0');
        applyCompact(next);
    });

    filterToggle?.addEventListener('click', () => {
        const open = filterExtras?.classList.toggle('is-open');
        filterToggle.setAttribute('aria-expanded', String(Boolean(open)));
    });

    function selectClassFilter(nextValue) {
        state.classFilter = nextValue || '';
        if (classSelect) {
            classSelect.value = state.classFilter;
        }
        classTabsHost?.querySelectorAll('[data-class-tab]').forEach((btn) => {
            const active = btn.dataset.classTab === state.classFilter;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        renderView();
    }

    classTabsHost?.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-class-tab]');
        if (!btn) return;
        selectClassFilter(btn.dataset.classTab);
    });

    classSelect?.addEventListener('change', () => {
        selectClassFilter(classSelect.value);
    });

    searchInput?.addEventListener('input', () => {
        state.search = searchInput.value;
        renderView();
    });

    dateInput?.addEventListener('change', () => {
        state.date = dateInput.value || todayIso();
        dateInput.value = state.date;
        loadBoard();
    });

    slotInput?.addEventListener('change', () => {
        state.slot = slotInput.value.trim() || 'Chính';
        slotInput.value = state.slot;
        loadBoard();
    });

    loadButton?.addEventListener('click', () => {
        state.date = dateInput?.value || state.date;
        state.slot = slotInput?.value.trim() || 'Chính';
        loadBoard();
    });

    function syncRowUi(tr, row) {
        if (!tr) return;
        tr.className = rowToneClass(row.status);
        tr.querySelectorAll('[data-pick-status]').forEach((btn) => {
            const active = btn.dataset.pickStatus === row.status;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    tableHost?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-pick-student]');
        if (!button || button.disabled) {
            return;
        }
        const studentId = Number(button.dataset.pickStudent);
        const picked = button.dataset.pickStatus;
        const row = state.allRows.find((item) => item.student_id === studentId);
        if (!row || !canEditRow(row)) {
            return;
        }
        row.status = row.status === picked ? null : picked;
        syncRowUi(button.closest('tr'), row);
        updateSummary();
        persistDraft();
    });

    tableHost?.addEventListener('input', (event) => {
        const note = event.target.closest('[data-note-for]');
        if (note) {
            const row = state.allRows.find((item) => item.student_id === Number(note.dataset.noteFor));
            if (row) {
                row.note = note.value;
                persistDraft();
            }
        }
    });

    function handleMarkAll() {
        const rows = visibleRows();
        let changed = 0;
        rows.forEach((row) => {
            if (canEditRow(row)) {
                row.status = 'present';
                changed += 1;
            }
        });
        if (!changed) {
            return;
        }
        tableHost?.querySelectorAll('tbody tr').forEach((tr) => {
            const firstBtn = tr.querySelector('[data-pick-student]');
            if (!firstBtn) return;
            const row = state.allRows.find((item) => item.student_id === Number(firstBtn.dataset.pickStudent));
            if (row && canEditRow(row)) {
                syncRowUi(tr, row);
            }
        });
        updateSummary();
        persistDraft();
    }

    async function handleSave() {
        if (state.saving) {
            return;
        }
        const editableRows = state.allRows.filter((row) => canEditRow(row));
        const records = editableRows
            .filter((row) => row.status)
            .map((row) => ({
                student_id: row.student_id,
                status: row.status,
                note: row.note?.trim() || null
            }));
        const clearedStudentIds = editableRows
            .filter((row) => !row.status && row.initial_status)
            .map((row) => row.student_id);

        if (!records.length && !clearedStudentIds.length) {
            showToast('Chưa tích chọn trạng thái cho học viên nào', 'warning');
            return;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            persistDraft();
            showToast('Đang mất kết nối mạng. Các mục vừa tích vẫn được giữ nháp an toàn trên máy — có mạng hãy bấm Lưu lại.', 'warning', 6000);
            return;
        }
        state.saving = true;
        saveButtons.forEach((btn) => setLoading(btn, true, 'Đang lưu...'));
        try {
            await api.post('/attendance/save', {
                session_date: state.date,
                slot_name: state.slot,
                records,
                cleared_student_ids: clearedStudentIds
            });
            clearDraft();
            state.lastSavedAt = new Date();
            showToast(`Đã lưu điểm danh an toàn cho ${records.length} học viên`, 'success');
            await loadBoard();
        } catch (error) {
            persistDraft();
            const baseMsg = error.message || 'Không lưu được điểm danh';
            showToast(`${baseMsg} Các mục vừa tích vẫn được giữ nháp trên máy.`, 'danger', 6000);
        } finally {
            state.saving = false;
            saveButtons.forEach((btn) => setLoading(btn, false));
            syncSaveButtonBadge();
        }
    }

    window.addEventListener('beforeunload', (event) => {
        if (window.__hkSkipBeforeUnload) {
            return;
        }
        if (dirtyCount() > 0) {
            event.preventDefault();
            event.returnValue = '';
        }
    });

    markAllButtons.forEach((btn) => btn.addEventListener('click', handleMarkAll));
    saveButtons.forEach((btn) => btn.addEventListener('click', handleSave));

    lockActions?.addEventListener('click', async (event) => {
        const dayBtn = event.target.closest('[data-lock-day]');
        if (dayBtn) {
            const unlocking = dayBtn.dataset.lockDay === 'unlock';
            const confirmed = await confirmAction({
                title: unlocking ? 'Mở khoá toàn bộ sổ ngày này' : 'Khoá toàn bộ sổ ngày này',
                message: unlocking
                    ? `Mở khoá toàn bộ sổ điểm danh ngày ${date(state.date)} (ca ${state.slot})?`
                    : `Khoá toàn bộ sổ điểm danh ngày ${date(state.date)} (ca ${state.slot})? Nhân viên không có quyền chỉnh sửa sẽ không thể thay đổi.`,
                tone: unlocking ? 'warning' : 'danger',
                confirmText: unlocking ? 'Mở khoá' : 'Khoá sổ'
            });
            if (!confirmed) return;
            try {
                await api.post(`/attendance/${unlocking ? 'unlock-day' : 'lock-day'}`, {
                    session_date: state.date,
                    slot_name: state.slot
                });
                showToast(unlocking ? 'Đã mở khoá toàn bộ sổ điểm danh' : 'Đã khoá toàn bộ sổ điểm danh', 'success');
                await loadBoard();
            } catch (error) {
                showToast(error.message || 'Không đổi được trạng thái sổ', 'danger');
            }
            return;
        }

        const sessionBtn = event.target.closest('[data-lock-session]');
        if (!sessionBtn) return;
        const sessionId = Number(sessionBtn.dataset.lockSession);
        const unlocking = sessionBtn.dataset.lockAction === 'unlock';
        const confirmed = await confirmAction({
            title: unlocking ? 'Mở khoá sổ điểm danh' : 'Khoá sổ điểm danh',
            message: unlocking
                ? `Mở khoá sổ ngày ${date(state.date)}? Nhân viên có quyền sẽ chỉnh sửa được.`
                : `Khoá sổ ngày ${date(state.date)}? Nhân viên không có quyền chỉnh sửa sẽ không thể thay đổi.`,
            tone: unlocking ? 'warning' : 'danger',
            confirmText: unlocking ? 'Mở khoá' : 'Khoá sổ'
        });
        if (!confirmed) return;
        try {
            await api.post(`/attendance/sessions/${sessionId}/${unlocking ? 'unlock' : 'lock'}`);
            showToast(unlocking ? 'Đã mở khoá sổ điểm danh' : 'Đã khoá sổ điểm danh', 'success');
            await loadBoard();
        } catch (error) {
            showToast(error.message || 'Không đổi được trạng thái sổ', 'danger');
        }
    });

    initBoard();
}
