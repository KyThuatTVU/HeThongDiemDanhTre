import { api } from '../../assets/js/core/http.js';
import { can } from '../../assets/js/core/auth.js';
import { createTable } from '../data-table/data-table.js';
import { confirmAction } from '../modal/modal.js';
import { showToast } from '../toast/toast.js';
import { date, datetime, number, statusMeta, todayIso } from '../../assets/js/core/format.js';
import { escapeHtml, qs, setLoading } from '../../assets/js/core/dom.js';

const STATUS_OPTIONS = [
    ['', 'Chưa điểm danh'],
    ['present', 'Có mặt'],
    ['late', 'Đi trễ'],
    ['excused_absent', 'Vắng có phép'],
    ['unexcused_absent', 'Vắng không phép'],
    ['planned_leave', 'Nghỉ báo trước']
];

function toneOf(status) {
    return status ? statusMeta('attendance', status).tone : 'neutral';
}

export function init(root) {
    const state = {
        classes: [],
        classId: null,
        date: todayIso(),
        slot: 'Chính',
        rows: [],
        session: null,
        locked: false,
        loading: false
    };
    let requestSeq = 0;

    const classSelect = qs('[data-att-class]', root);
    const dateInput = qs('[data-att-date]', root);
    const slotInput = qs('[data-att-slot]', root);
    const loadButton = qs('[data-att-load]', root);
    const titleNode = qs('[data-att-title]', root);
    const subtitleNode = qs('[data-att-subtitle]', root);
    const banner = qs('[data-att-banner]', root);
    const lockStatus = qs('[data-att-lock-status]', root);
    const lockActions = qs('[data-att-lock-actions]', root);
    const saveBar = qs('[data-att-savebar]', root);
    const saveButton = qs('[data-att-save]', root);
    const markAllButton = qs('[data-att-mark-all]', root);

    const table = createTable(qs('[data-att-table]', root), {
        emptyTitle: 'Lớp chưa có học viên đang học',
        emptyHint: 'Xếp học viên vào lớp trước khi điểm danh.',
        emptyIcon: 'bi-calendar2-x',
        columns: [
            {
                label: 'Học viên',
                render: (row) => `<span class="att-student-name">${escapeHtml(row.full_name)}</span>
                    <span class="fs-13 text-muted-2">${escapeHtml(row.student_code)}</span>`
            },
            {
                label: 'Liên hệ',
                render: (row) => row.guardian_name || row.guardian_phone
                    ? `<span class="d-block">${escapeHtml(row.guardian_name || '—')}</span>
                       <span class="fs-13 text-muted-2">${escapeHtml(row.guardian_phone || '')}</span>`
                    : '<span class="text-muted-2">—</span>'
            },
            {
                label: 'Trạng thái',
                render: (row) => {
                    const editable = isEditable();
                    const options = STATUS_OPTIONS.map(([value, label]) =>
                        `<option value="${value}"${row.status === value || (row.status === null && value === '') ? ' selected' : ''}>${label}</option>`
                    ).join('');
                    return `<select class="form-select form-select-sm att-status att-status--${toneOf(row.status)}"
                        data-status-for="${row.student_id}"${editable ? '' : ' disabled'}>${options}</select>`;
                }
            },
            {
                label: 'Ghi chú',
                render: (row) => `<input type="text" class="form-control form-control-sm att-note"
                    maxlength="255" placeholder="Ghi chú..." value="${escapeHtml(row.note || '')}"
                    data-note-for="${row.student_id}"${isEditable() ? '' : ' disabled'}>`
            },
            {
                label: 'Ghi nhận',
                render: (row) => row.recorded_at
                    ? `<span class="att-recording">${escapeHtml(datetime(row.recorded_at))}</span>`
                    : '<span class="text-muted-2">—</span>'
            }
        ]
    });

    function isEditable() {
        return can('attendance.save') && (!state.locked || can('attendance.edit'));
    }

    function updateSummary() {
        let present = 0;
        let absent = 0;
        let unrecorded = 0;
        state.rows.forEach((row) => {
            if (!row.status) {
                unrecorded += 1;
            } else if (row.status === 'present' || row.status === 'late') {
                present += 1;
            } else {
                absent += 1;
            }
        });
        const presentNode = qs('[data-att-present]', root);
        const absentNode = qs('[data-att-absent]', root);
        const unrecordedNode = qs('[data-att-unrecorded]', root);
        if (presentNode) presentNode.textContent = number(present);
        if (absentNode) absentNode.textContent = number(absent);
        if (unrecordedNode) unrecordedNode.textContent = number(unrecorded);
    }

    function syncUrl() {
        const url = new URL(window.location.href);
        if (state.classId) {
            url.searchParams.set('class_id', String(state.classId));
        }
        url.searchParams.set('date', state.date);
        url.searchParams.set('slot', state.slot);
        window.history.replaceState(null, '', url);
    }

    function renderLockUi(data) {
        const session = state.session;
        if (!lockStatus || !lockActions) {
            return;
        }
        if (!session) {
            lockStatus.innerHTML = '<span class="hk-chip">Chưa lưu sổ</span>';
        } else if (session.is_locked) {
            lockStatus.innerHTML = `<span class="hk-chip text-danger"><i class="bi bi-lock-fill me-1"></i>Đã khoá · ${escapeHtml(datetime(session.locked_at))}</span>`;
        } else {
            lockStatus.innerHTML = '<span class="hk-chip text-success"><i class="bi bi-unlock me-1"></i>Đang mở</span>';
        }

        if (session && can('attendance.lock')) {
            lockActions.innerHTML = session.is_locked
                ? '<button type="button" class="btn-hk-outline btn-sm" data-lock-action="unlock"><i class="bi bi-unlock me-1"></i>Mở khoá</button>'
                : '<button type="button" class="btn-hk-outline btn-sm" data-lock-action="lock"><i class="bi bi-lock me-1"></i>Khoá sổ</button>';
        } else {
            lockActions.innerHTML = '';
        }

        if (saveBar) {
            saveBar.hidden = !can('attendance.save');
        }
        const editable = isEditable();
        if (saveButton) saveButton.disabled = !editable;
        if (markAllButton) markAllButton.disabled = !editable;

        if (banner) {
            if (session?.is_locked) {
                banner.hidden = false;
                banner.classList.toggle('att-banner--info', can('attendance.edit'));
                banner.innerHTML = can('attendance.edit')
                    ? '<i class="bi bi-info-circle me-1"></i>Sổ điểm danh đã khoá. Bạn có quyền chỉnh sửa nên vẫn có thể cập nhật và lưu lại.'
                    : '<i class="bi bi-lock me-1"></i>Sổ điểm danh đã khoá. Liên hệ quản lý cơ sở nếu cần điều chỉnh.';
            } else {
                banner.hidden = true;
            }
        }

        if (titleNode) {
            titleNode.textContent = `${data.class?.name || 'Sổ điểm danh'} · ${date(state.date)}`;
        }
        if (subtitleNode) {
            subtitleNode.textContent = `Ca ${state.slot}${data.class?.branch_name ? ` · ${data.class.branch_name}` : ''}`;
            subtitleNode.hidden = false;
        }
    }

    function applyBoard(data) {
        state.session = data.session || null;
        state.locked = Boolean(data.session?.is_locked);
        state.rows = (data.students || []).map((row) => ({
            student_id: Number(row.student_id),
            student_code: row.student_code,
            full_name: row.full_name,
            guardian_name: row.guardian_name,
            guardian_phone: row.guardian_phone,
            status: row.status || null,
            note: row.note || '',
            recorded_at: row.recorded_at || null
        }));
        table.render(state.rows);
        renderLockUi(data);
        updateSummary();
        syncUrl();
    }

    async function loadBoard() {
        if (!state.classId) {
            table.render([]);
            return;
        }
        const seq = ++requestSeq;
        state.loading = true;
        table.setLoading();
        if (titleNode) {
            titleNode.textContent = 'Đang tải sổ điểm danh...';
        }
        try {
            const payload = await api.get('/attendance/board', {
                class_id: state.classId,
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

    async function loadClasses() {
        try {
            const payload = await api.get('/classes');
            state.classes = payload?.data || [];
        } catch (error) {
            showToast(error.message || 'Không tải được danh sách lớp', 'danger');
            state.classes = [];
        }

        if (!classSelect) {
            return;
        }
        if (!state.classes.length) {
            classSelect.innerHTML = '<option value="">Chưa có lớp học</option>';
            if (titleNode) {
                titleNode.textContent = 'Chưa có lớp học';
            }
            table.render([]);
            if (saveBar) saveBar.hidden = true;
            return;
        }
        classSelect.innerHTML = state.classes.map((item) =>
            `<option value="${item.id}">${escapeHtml(item.name)}${item.status === 'inactive' ? ' (ngừng)' : ''}</option>`
        ).join('');

        const params = new URLSearchParams(window.location.search);
        const initialClass = Number(params.get('class_id') || 0);
        const exists = state.classes.some((item) => Number(item.id) === initialClass);
        state.classId = exists ? initialClass : Number(state.classes[0].id);
        classSelect.value = String(state.classId);

        const initialDate = params.get('date');
        if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
            state.date = initialDate;
        }
        const initialSlot = (params.get('slot') || '').trim();
        if (initialSlot) {
            state.slot = initialSlot;
        }
        if (dateInput) dateInput.value = state.date;
        if (slotInput) slotInput.value = state.slot;

        await loadBoard();
    }

    classSelect?.addEventListener('change', () => {
        state.classId = Number(classSelect.value) || null;
        loadBoard();
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

    qs('[data-att-table]', root)?.addEventListener('change', (event) => {
        const select = event.target.closest('[data-status-for]');
        if (select) {
            const row = state.rows.find((item) => item.student_id === Number(select.dataset.statusFor));
            if (row) {
                row.status = select.value || null;
                select.className = `form-select form-select-sm att-status att-status--${toneOf(row.status)}`;
                updateSummary();
            }
            return;
        }
        const note = event.target.closest('[data-note-for]');
        if (note) {
            const row = state.rows.find((item) => item.student_id === Number(note.dataset.noteFor));
            if (row) {
                row.note = note.value;
            }
        }
    });

    qs('[data-att-table]', root)?.addEventListener('input', (event) => {
        const note = event.target.closest('[data-note-for]');
        if (note) {
            const row = state.rows.find((item) => item.student_id === Number(note.dataset.noteFor));
            if (row) {
                row.note = note.value;
            }
        }
    });

    markAllButton?.addEventListener('click', () => {
        if (!isEditable()) {
            return;
        }
        state.rows.forEach((row) => {
            row.status = 'present';
        });
        qs('[data-att-table]', root)?.querySelectorAll('[data-status-for]').forEach((select) => {
            select.value = 'present';
            select.className = 'form-select form-select-sm att-status att-status--success';
        });
        updateSummary();
    });

    saveButton?.addEventListener('click', async () => {
        if (!isEditable()) {
            return;
        }
        const records = state.rows
            .filter((row) => row.status)
            .map((row) => ({
                student_id: row.student_id,
                status: row.status,
                note: row.note?.trim() || null
            }));
        if (!records.length) {
            showToast('Chưa chọn trạng thái cho học viên nào', 'warning');
            return;
        }
        setLoading(saveButton, true, 'Đang lưu...');
        try {
            await api.post('/attendance/save', {
                class_id: state.classId,
                session_date: state.date,
                slot_name: state.slot,
                records
            });
            showToast(`Đã lưu điểm danh cho ${records.length} học viên`, 'success');
            await loadBoard();
        } catch (error) {
            showToast(error.message || 'Không lưu được điểm danh', 'danger');
        } finally {
            setLoading(saveButton, false);
        }
    });

    lockActions?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-lock-action]');
        if (!button || !state.session) {
            return;
        }
        const unlocking = button.dataset.lockAction === 'unlock';
        const confirmed = await confirmAction({
            title: unlocking ? 'Mở khoá sổ điểm danh' : 'Khoá sổ điểm danh',
            message: unlocking
                ? `Mở khoá sổ ngày ${date(state.date)}? Nhân viên có quyền sẽ chỉnh sửa được.`
                : `Khoá sổ ngày ${date(state.date)}? Nhân viên không có quyền chỉnh sửa sẽ không thể thay đổi.`,
            tone: unlocking ? 'warning' : 'danger',
            confirmText: unlocking ? 'Mở khoá' : 'Khoá sổ'
        });
        if (!confirmed) {
            return;
        }
        try {
            await api.post(`/attendance/sessions/${state.session.id}/${unlocking ? 'unlock' : 'lock'}`);
            showToast(unlocking ? 'Đã mở khoá sổ điểm danh' : 'Đã khoá sổ điểm danh', 'success');
            await loadBoard();
        } catch (error) {
            showToast(error.message || 'Không đổi được trạng thái sổ', 'danger');
        }
    });

    loadClasses();
}
