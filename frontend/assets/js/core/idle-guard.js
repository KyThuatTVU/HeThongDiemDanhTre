// Bảo vệ phiên làm việc khi giáo viên để mở trang web lâu không thao tác:
// - KHÔNG gọi server ngầm khi để máy rảnh (0 tải khi mở tab để đó)
// - CHỈ gửi 1 gói ping nhẹ khi cô ĐANG thao tác liên tục lâu trên 1 trang (vd: tích điểm danh >15 phút)
//   để không bị hết phiên đúng lúc bấm Lưu
// - Đồng bộ mốc hoạt động & đăng xuất tức thì giữa nhiều tab qua localStorage
// - Cảnh báo trước 2 phút và tự đăng xuất sạch sẽ (không bị hộp thoại trình duyệt chặn) khi quá giờ
import { api, getLastServerTouch } from './http.js';
import { LOGOUT_SIGNAL_KEY, logout, redirectToLogin, session } from './auth.js';

const STORAGE_KEY = 'hk_last_activity_at';
const WARN_BEFORE_MS = 2 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;
const TOUCH_THROTTLE_MS = 15 * 1000;

let started = false;
let loggingOut = false;
let keepaliveInFlight = false;
let lastKeepaliveAttemptAt = 0;
let keepaliveFailCount = 0;
let lastLocalTouch = 0;
let warningBanner = null;
let countdownTimer = null;
let checkTimer = null;

function nowMs() {
    return Date.now();
}

function timeoutMs() {
    return Math.max(5, Number(session.idleTimeoutMinutes || 30)) * 60 * 1000;
}

function keepaliveGapMs() {
    // Gia hạn phía máy chủ khi đang thao tác thật sự: tối đa 10 phút/lần hoặc 1/2 thời gian chờ
    return Math.min(10 * 60 * 1000, Math.floor(timeoutMs() / 2));
}

function readLastActivity() {
    const stored = Number(localStorage.getItem(STORAGE_KEY) || 0);
    return Number.isFinite(stored) && stored > 0 ? stored : nowMs();
}

function writeLastActivity(ts = nowMs()) {
    lastLocalTouch = ts;
    try {
        localStorage.setItem(STORAGE_KEY, String(ts));
    } catch {
        // Bỏ qua nếu trình duyệt chặn storage
    }
}

function clearTimers() {
    if (countdownTimer !== null) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
    }
    if (checkTimer !== null) {
        window.clearInterval(checkTimer);
        checkTimer = null;
    }
}

function removeBanner() {
    if (countdownTimer !== null) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
    }
    if (warningBanner) {
        warningBanner.remove();
        warningBanner = null;
    }
}

function formatClock(dateObj = new Date()) {
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

async function performAutoLogout() {
    if (loggingOut) {
        return;
    }
    loggingOut = true;
    removeBanner();
    clearTimers();
    const mins = Math.max(5, Number(session.idleTimeoutMinutes || 30));
    const notice = `Hệ thống đã tự đăng xuất lúc ${formatClock()} do không thao tác trong ${mins} phút để nhẹ máy và bảo vệ dữ liệu. Các mục điểm danh chưa lưu vẫn được giữ nháp trên máy — cô chỉ cần đăng nhập lại để tiếp tục.`;
    await logout({
        rememberNext: true,
        notice,
        tone: 'info',
        broadcast: true
    });
}

async function maybeKeepServerAlive() {
    if (loggingOut || keepaliveInFlight || warningBanner) {
        return;
    }
    if (document.visibilityState !== 'visible') {
        return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
    }
    const lastServer = getLastServerTouch();
    const now = nowMs();
    // CHỈ gia hạn nếu thực sự có thao tác người dùng MỚI HƠN lần gọi server gần nhất
    if (lastLocalTouch <= lastServer) {
        return;
    }
    if (now - lastServer < keepaliveGapMs()) {
        return;
    }
    // Nếu mạng chập chờn làm lần ping trước thất bại, giãn thời gian thử lại (1 -> 2 -> 5 phút)
    // để tuyệt đối không spam API liên tục.
    const backoffMs = keepaliveFailCount === 0
        ? 0
        : Math.min(5 * 60 * 1000, 60 * 1000 * (2 ** (keepaliveFailCount - 1)));
    if (backoffMs > 0 && (now - lastKeepaliveAttemptAt) < backoffMs) {
        return;
    }
    keepaliveInFlight = true;
    lastKeepaliveAttemptAt = now;
    try {
        await api.get('/auth/ping');
        keepaliveFailCount = 0;
    } catch {
        keepaliveFailCount = Math.min(keepaliveFailCount + 1, 4);
        // Nếu đã hết phiên (401), listener hk:session-expired sẽ tự xử lý
    } finally {
        keepaliveInFlight = false;
    }
}

function ensureBanner() {
    if (warningBanner) {
        return warningBanner;
    }
    const bar = document.createElement('div');
    bar.className = 'hk-idle-banner no-print';
    bar.setAttribute('role', 'alert');
    bar.innerHTML = `
        <div class="hk-idle-banner__body">
            <i class="bi bi-clock-history"></i>
            <span>Bạn không thao tác đã lâu. Hệ thống sẽ tự đăng xuất sau <strong data-idle-left>--</strong> để nhẹ máy và bảo mật.</span>
        </div>
        <div class="hk-idle-banner__actions">
            <button type="button" class="btn-hk btn-sm" data-idle-continue>Tiếp tục làm việc</button>
            <button type="button" class="btn-hk-outline btn-sm" data-idle-logout>Đăng xuất ngay</button>
        </div>`;

    bar.querySelector('[data-idle-continue]')?.addEventListener('click', async () => {
        writeLastActivity();
        removeBanner();
        try {
            await api.get('/auth/ping');
        } catch {
            // Nếu backend đã hết phiên thì 401 listener sẽ tự điều hướng
        }
    });
    bar.querySelector('[data-idle-logout]')?.addEventListener('click', () => {
        loggingOut = true;
        removeBanner();
        clearTimers();
        logout();
    });

    document.body.appendChild(bar);
    warningBanner = bar;
    return bar;
}

function formatLeft(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m} phút ${String(s).padStart(2, '0')} giây` : `${s} giây`;
}

function updateBannerCountdown() {
    const remaining = timeoutMs() - (nowMs() - readLastActivity());
    if (remaining <= 0) {
        performAutoLogout();
        return;
    }
    if (remaining > WARN_BEFORE_MS) {
        removeBanner();
        return;
    }
    const bar = ensureBanner();
    const node = bar.querySelector('[data-idle-left]');
    if (node) {
        node.textContent = formatLeft(remaining);
    }
}

function checkIdle() {
    if (loggingOut) {
        return;
    }
    const elapsed = nowMs() - readLastActivity();
    const limit = timeoutMs();
    if (elapsed >= limit) {
        performAutoLogout();
        return;
    }
    if (limit - elapsed <= WARN_BEFORE_MS) {
        updateBannerCountdown();
        if (countdownTimer === null) {
            countdownTimer = window.setInterval(updateBannerCountdown, 1000);
        }
        return;
    }
    if (warningBanner) {
        removeBanner();
    }
    maybeKeepServerAlive();
}

function onUserActivity() {
    if (loggingOut || warningBanner) {
        return;
    }
    const ts = nowMs();
    if (ts - lastLocalTouch >= TOUCH_THROTTLE_MS) {
        writeLastActivity(ts);
        maybeKeepServerAlive();
    }
}

export function startIdleGuard() {
    if (started) {
        return;
    }
    started = true;
    writeLastActivity();

    ['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
        window.addEventListener(evt, onUserActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkIdle();
        }
    });

    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) {
            checkIdle();
        } else if (event.key === LOGOUT_SIGNAL_KEY && event.newValue) {
            if (!loggingOut) {
                loggingOut = true;
                removeBanner();
                clearTimers();
                redirectToLogin({ rememberNext: false });
            }
        }
    });

    checkTimer = window.setInterval(checkIdle, CHECK_INTERVAL_MS);
}
