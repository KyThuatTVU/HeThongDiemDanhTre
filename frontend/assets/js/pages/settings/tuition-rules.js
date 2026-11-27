import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { confirmAction } from '../../../../components/modal/modal.js';
import { can, session } from '../../core/auth.js';
import { flash } from '../../core/flash.js';
import { API_BASE, DASHBOARD_URL } from '../../core/config.js';
import { escapeHtml, qs, setLoading } from '../../core/dom.js';
import { number } from '../../core/format.js';

const form = qs('[data-settings-form]');
const submitButton = qs('[data-submit]');

function setHint(text, isError = false) {
    const hint = qs('[data-form-hint]');
    if (!hint) {
        return;
    }
    hint.textContent = text || '';
    hint.classList.toggle('form-hint--error', Boolean(isError));
}

function applySettings(rows) {
    const map = new Map();
    (rows || []).forEach((row) => {
        map.set(String(row.setting_key), row.setting_value ?? '');
    });
    form.querySelectorAll('[name]').forEach((input) => {
        const value = map.get(input.name);
        if (value !== undefined) {
            input.value = value;
        }
    });
}

async function loadSettings() {
    setHint('Đang tải cấu hình...');
    try {
        const payload = await api.get('/settings');
        applySettings(payload?.data || []);
        setHint('');
    } catch (error) {
        setHint(error.message || 'Không tải được cấu hình', true);
        showToast(error.message || 'Không tải được cấu hình', 'danger');
    }
}

function readNumber(input, min, max) {
    if (!input) {
        return { ok: true, value: '' };
    }
    const raw = input.value.trim();
    if (raw === '') {
        return { ok: true, value: '' };
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < min || (max !== null && parsed > max)) {
        return { ok: false, value: raw };
    }
    return { ok: true, value: String(parsed) };
}

async function submit(event) {
    event.preventDefault();
    setHint('');

    const dueDay = readNumber(qs('[name="tuition.payment_due_day"]'), 1, 28);
    if (!dueDay.ok) {
        setHint('Hạn thu học phí phải là ngày từ 1 đến 28.', true);
        return;
    }
    const absentDeduction = readNumber(qs('[name="tuition.absent_deduction_amount"]'), 0, null);
    const lateDeduction = readNumber(qs('[name="tuition.late_deduction_amount"]'), 0, null);
    const excusedDeduction = readNumber(qs('[name="tuition.excused_deduction_amount"]'), 0, null);
    if (!absentDeduction.ok || !lateDeduction.ok || !excusedDeduction.ok) {
        setHint('Mức giảm trừ phải là số không âm.', true);
        return;
    }

    const settings = {
        'general.center_name': (qs('[name="general.center_name"]').value || '').trim(),
        'general.hotline': (qs('[name="general.hotline"]').value || '').trim(),
        'general.address': (qs('[name="general.address"]').value || '').trim(),
        'tuition.payment_due_day': dueDay.value,
        'tuition.absent_deduction_amount': absentDeduction.value,
        'tuition.late_deduction_amount': lateDeduction.value,
        'tuition.excused_deduction_amount': excusedDeduction.value,
        'tuition.rule_note': (qs('[name="tuition.rule_note"]').value || '').trim()
    };

    setLoading(submitButton, true, 'Đang lưu...');
    try {
        const payload = await api.put('/settings', { settings });
        applySettings(payload?.data || []);
        flash('Đã lưu cấu hình hệ thống', 'success');
        showToast('Đã lưu cấu hình hệ thống', 'success');
        setHint('Cấu hình đã được cập nhật.');
    } catch (error) {
        if (error.status === 422) {
            setHint(error.message || 'Dữ liệu cấu hình không hợp lệ.', true);
        } else {
            setHint(error.message || 'Không lưu được cấu hình', true);
        }
        showToast(error.message || 'Không lưu được cấu hình', 'danger');
    } finally {
        setLoading(submitButton, false);
    }
}

function renderMaintenanceStats(data) {
    const grid = qs('[data-maint-stats]');
    const note = qs('[data-maint-note]');
    if (!grid || !data) {
        return;
    }
    const db = data.database || {};
    const storage = data.storage || {};
    const folders = storage.folders || {};
    const retention = data.retention || {};

    const tableCount = (db.tables || []).reduce((sum, item) => sum + Number(item.rows || 0), 0);
    const logTable = (db.tables || []).find((t) => t.name === 'activity_logs');
    const loginTable = (db.tables || []).find((t) => t.name === 'login_histories');
    const logRows = Number(logTable?.rows || 0) + Number(loginTable?.rows || 0);

    grid.innerHTML = `
        <div class="settings-maint__item">
            <span class="settings-maint__label">Cơ sở dữ liệu MySQL</span>
            <strong class="settings-maint__value">${escapeHtml(String(db.total_mb ?? 0))} MB</strong>
            <span class="settings-maint__sub">~${number(tableCount)} dòng dữ liệu</span>
        </div>
        <div class="settings-maint__item">
            <span class="settings-maint__label">Nhật ký hệ thống (DB)</span>
            <strong class="settings-maint__value">${number(logRows)} dòng</strong>
            <span class="settings-maint__sub">Tự dọn sau ${number(retention.db_log_keep_days || 90)} ngày</span>
        </div>
        <div class="settings-maint__item">
            <span class="settings-maint__label">Ảnh tải lên (Uploads)</span>
            <strong class="settings-maint__value">${escapeHtml(String(folders.uploads?.mb ?? 0))} MB</strong>
            <span class="settings-maint__sub">${number(folders.uploads?.files || 0)} tệp${retention.gd_available ? ` · nén ≤${retention.upload_max_dimension || 480}px` : ''}</span>
        </div>
        <div class="settings-maint__item">
            <span class="settings-maint__label">Tệp tạm (Cache / Log / Phiên)</span>
            <strong class="settings-maint__value">${escapeHtml(String(storage.total_mb ?? 0))} MB</strong>
            <span class="settings-maint__sub">${number(storage.total_files || 0)} tệp trong storage</span>
        </div>`;

    if (note) {
        note.textContent = 'Gợi ý khi dùng host miễn phí (ByetHost): mỗi tuần bấm "Tải sao lưu (.sql)" để lưu dự phòng về máy tính hoặc Google Drive; dữ liệu học viên, điểm danh và học phí không bao giờ bị xoá khi dọn rác.';
    }
}

async function loadMaintenanceStats() {
    const grid = qs('[data-maint-stats]');
    if (grid) {
        grid.innerHTML = '<div class="settings-maint__loading">Đang kiểm tra dung lượng hệ thống...</div>';
    }
    try {
        const payload = await api.get('/system/storage');
        renderMaintenanceStats(payload?.data);
    } catch (error) {
        if (grid) {
            grid.innerHTML = `<div class="settings-maint__loading text-danger">${escapeHtml(error.message || 'Không đọc được thống kê dung lượng')}</div>`;
        }
    }
}

function initMaintenance() {
    const section = qs('[data-maintenance-section]');
    if (!section || session.role?.key !== 'super_admin') {
        return;
    }
    section.hidden = false;

    const backupLink = qs('[data-maint-backup]');
    if (backupLink) {
        backupLink.href = `${API_BASE}/system/backup-download`;
    }

    qs('[data-maint-refresh]')?.addEventListener('click', () => {
        loadMaintenanceStats();
    });

    const cleanupBtn = qs('[data-maint-cleanup]');
    cleanupBtn?.addEventListener('click', async () => {
        const confirmed = await confirmAction({
            title: 'Dọn rác & tối ưu hệ thống',
            message: 'Hệ thống sẽ xoá file cache/phiên hết hạn, file log cũ và nhật ký thao tác quá 90 ngày. Toàn bộ dữ liệu học viên, điểm danh và học phí được giữ nguyên.',
            confirmText: 'Dọn rác ngay',
            tone: 'warning'
        });
        if (!confirmed) {
            return;
        }
        setLoading(cleanupBtn, true, 'Đang dọn...');
        try {
            const payload = await api.post('/system/cleanup', {});
            const result = payload?.data || {};
            if (result.stats) {
                renderMaintenanceStats(result.stats);
            } else {
                await loadMaintenanceStats();
            }
            const files = result.files_removed || {};
            const totalFiles = Number(files.cache || 0) + Number(files.rate_limit || 0) + Number(files.sessions || 0) + Number(files.logs || 0);
            const rows = result.db_rows_removed || {};
            const totalRows = Number(rows.activity_logs || 0) + Number(rows.login_histories || 0);
            showToast(`Đã dọn ${number(totalFiles)} tệp tạm và ${number(totalRows)} dòng nhật ký cũ.`, 'success');
        } catch (error) {
            showToast(error.message || 'Không dọn được rác hệ thống', 'danger');
        } finally {
            setLoading(cleanupBtn, false);
        }
    });

    loadMaintenanceStats();
}

document.addEventListener('hk:ready', () => {
    if (!can('settings.manage')) {
        showToast('Bạn không có quyền quản lý cấu hình hệ thống', 'danger');
        window.location.replace(DASHBOARD_URL);
        return;
    }
    form.addEventListener('submit', submit);
    loadSettings();
    initMaintenance();
});
