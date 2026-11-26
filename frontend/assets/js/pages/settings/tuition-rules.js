import { api } from '../../core/http.js';
import { showToast } from '../../../../components/toast/toast.js';
import { can } from '../../core/auth.js';
import { flash } from '../../core/flash.js';
import { DASHBOARD_URL } from '../../core/config.js';
import { qs, setLoading } from '../../core/dom.js';

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

document.addEventListener('hk:ready', () => {
    if (!can('settings.manage')) {
        showToast('Bạn không có quyền quản lý cấu hình hệ thống', 'danger');
        window.location.replace(DASHBOARD_URL);
        return;
    }
    form.addEventListener('submit', submit);
    loadSettings();
});
