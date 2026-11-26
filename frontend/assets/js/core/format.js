// Định dạng ngày giờ, tiền tệ và nhãn trạng thái
const moneyFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export function money(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return '0 đ';
    }
    return `${moneyFormatter.format(number)} đ`;
}

export function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? moneyFormatter.format(parsed) : '0';
}

export function percent(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${parsed.toFixed(1).replace('.0', '')}%` : '0%';
}

export function date(value) {
    if (!value) {
        return '—';
    }
    const part = String(value).slice(0, 10);
    const [year, month, day] = part.split('-');
    if (!year || !month || !day) {
        return String(value);
    }
    return `${day}/${month}/${year}`;
}

export function datetime(value) {
    if (!value) {
        return '—';
    }
    const text = String(value);
    const datePart = date(text);
    const timePart = text.slice(11, 16);
    return timePart ? `${datePart} ${timePart}` : datePart;
}

export function todayIso() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

export function monthLabel(year, month) {
    if (!year || !month) {
        return '—';
    }
    return `Tháng ${Number(month)}/${year}`;
}

export function initials(name) {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (parts.length === 0) {
        return '?';
    }
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function weekdayLabel(isoDate) {
    if (!isoDate) {
        return '';
    }
    const parsed = new Date(`${String(isoDate).slice(0, 10)}T00:00:00`);
    return new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(parsed);
}

const STUDENT_STATUS = {
    active: { label: 'Đang học', tone: 'success' },
    paused: { label: 'Tạm nghỉ', tone: 'warning' },
    left: { label: 'Đã nghỉ', tone: 'neutral' }
};

const TUITION_STATUS = {
    unpaid: { label: 'Chưa thu', tone: 'danger' },
    partial: { label: 'Thu một phần', tone: 'warning' },
    paid: { label: 'Đã thu đủ', tone: 'success' }
};

const ATTENDANCE_STATUS = {
    present: { label: 'Có mặt', tone: 'success' },
    late: { label: 'Đi trễ', tone: 'warning' },
    excused_absent: { label: 'Vắng có phép', tone: 'info' },
    unexcused_absent: { label: 'Vắng không phép', tone: 'danger' },
    planned_leave: { label: 'Nghỉ báo trước', tone: 'neutral' }
};

const USER_STATUS = {
    active: { label: 'Đang hoạt động', tone: 'success' },
    locked: { label: 'Đã khoá', tone: 'danger' }
};

const ROLE_LABELS = {
    super_admin: 'Quản trị hệ thống',
    branch_manager: 'Quản lý cơ sở',
    attendance_staff: 'Nhân viên điểm danh',
    profile_staff: 'Nhân viên hồ sơ'
};

const PAYMENT_METHODS = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
    other: 'Khác'
};

const GENDERS = {
    male: 'Nam',
    female: 'Nữ',
    other: 'Khác'
};

const LOGIN_METHODS = {
    password: 'Mật khẩu',
    google: 'Google'
};

export function statusMeta(kind, value) {
    const maps = {
        student: STUDENT_STATUS,
        tuition: TUITION_STATUS,
        attendance: ATTENDANCE_STATUS,
        user: USER_STATUS
    };
    return maps[kind]?.[value] || { label: value || '—', tone: 'neutral' };
}

export const labels = {
    role: (key) => ROLE_LABELS[key] || key || '—',
    gender: (key) => GENDERS[key] || '—',
    paymentMethod: (key) => PAYMENT_METHODS[key] || key || '—',
    loginMethod: (key) => LOGIN_METHODS[key] || key || '—',
    attendance: ATTENDANCE_STATUS,
    tuition: TUITION_STATUS,
    student: STUDENT_STATUS,
    user: USER_STATUS
};
