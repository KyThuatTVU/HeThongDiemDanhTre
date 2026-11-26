// Thông báo nhanh sau khi chuyển trang
const KEY = 'hk_flash';

export function flash(message, type = 'success') {
    if (!message) {
        return;
    }
    sessionStorage.setItem(KEY, JSON.stringify({ message, type }));
}

export function consumeFlash() {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) {
        return null;
    }
    sessionStorage.removeItem(KEY);
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}
