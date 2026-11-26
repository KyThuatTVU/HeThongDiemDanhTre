// Cấu hình dùng chung cho toàn bộ frontend tĩnh

// Thư mục frontend vật lý (dùng để tải layout/component)
export const ROOT = new URL('../../../', import.meta.url);

// Gốc dự án (nơi đặt router.php và các URL thân thiện)
export const SITE_ROOT = new URL('../../../../', import.meta.url);

function trimBase(value) {
    return String(value).replace(/\/+$/, '');
}

function detectApiBase() {
    const override = localStorage.getItem('hk_api_base');
    if (override) {
        return trimBase(override);
    }
    return trimBase(new URL('../../../../backend/public/api', import.meta.url).href);
}

export const API_BASE = detectApiBase();

// Bảng route dùng chung: slug trên URL <-> thư mục vật lý trong frontend/pages
export const PAGE_ROUTES = {
    login: { slug: 'login', dir: 'auth/login' },
    selectBranch: { slug: 'select-branch', dir: 'auth/select-branch' },
    dashboard: { slug: 'dashboard', dir: 'dashboard/overview' },
    students: { slug: 'students', dir: 'students/list' },
    studentForm: { slug: 'student-form', dir: 'students/form' },
    studentDetail: { slug: 'student', dir: 'students/detail' },
    classes: { slug: 'classes', dir: 'classes/list' },
    classForm: { slug: 'class-form', dir: 'classes/form' },
    classDetail: { slug: 'class', dir: 'classes/detail' },
    attendanceToday: { slug: 'attendance', dir: 'attendance/today' },
    attendanceBoard: { slug: 'attendance-board', dir: 'attendance/board' },
    attendanceHistory: { slug: 'attendance-history', dir: 'attendance/history' },
    tuitionList: { slug: 'tuition', dir: 'tuition/list' },
    tuitionBoard: { slug: 'tuition-board', dir: 'tuition/board' },
    tuitionDetail: { slug: 'tuition-detail', dir: 'tuition/detail' },
    staff: { slug: 'staff', dir: 'staff/list' },
    staffForm: { slug: 'staff-form', dir: 'staff/form' },
    branches: { slug: 'branches', dir: 'branches/list' },
    branchForm: { slug: 'branch-form', dir: 'branches/form' },
    reportStudents: { slug: 'report-students', dir: 'reports/students' },
    reportAttendance: { slug: 'report-attendance', dir: 'reports/attendance' },
    reportAttendanceSummary: { slug: 'report-attendance-summary', dir: 'reports/attendance-summary' },
    reportTuition: { slug: 'report-tuition', dir: 'reports/tuition' },
    reportMovements: { slug: 'report-movements', dir: 'reports/movements' },
    logs: { slug: 'logs', dir: 'logs/list' },
    settings: { slug: 'settings', dir: 'settings/tuition-rules' },
    profile: { slug: 'profile', dir: 'profile/account' }
};

export const PAGES = Object.fromEntries(
    Object.entries(PAGE_ROUTES).map(([key, route]) => [key, `${route.slug}/`])
);

export function pageUrl(relativePath) {
    return new URL(String(relativePath).replace(/^\/+/, ''), SITE_ROOT).href;
}

export const LOGIN_URL = pageUrl(PAGES.login);
export const DASHBOARD_URL = pageUrl(PAGES.dashboard);

export function fileUrl(relativePath) {
    if (!relativePath) {
        return '';
    }
    return `${API_BASE}/files/${String(relativePath).replace(/^\/+/, '')}`;
}

export const BRAND = {
    name: 'HappyKidsCK',
    tagline: 'Quản lý học viên & điểm danh'
};
