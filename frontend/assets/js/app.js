// Bootstrap chung cho các trang nội bộ
import { bootLayout } from './core/layout.js';
import { requireAuth, redirectToLogin, applyPermissionGuards } from './core/auth.js';
import { startIdleGuard } from './core/idle-guard.js';
import { consumeFlash } from './core/flash.js';
import { initFriendlyLinks } from './core/links.js';
import { showToast } from '../../components/toast/toast.js';

let redirecting = false;

initFriendlyLinks();

window.addEventListener('hk:session-expired', (event) => {
    if (redirecting || (document.body.dataset.auth || 'required') !== 'required') {
        return;
    }
    redirecting = true;
    const serverMsg = event?.detail?.message;
    const notice = serverMsg
        ? `${serverMsg} (Nếu cô đang tích điểm danh, bản nháp vẫn được giữ trên máy.)`
        : 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại. Các mục điểm danh chưa lưu vẫn được giữ nháp trên máy.';
    redirectToLogin({ rememberNext: true, notice, tone: 'warning' });
});

document.addEventListener('DOMContentLoaded', async () => {
    const mode = document.body.dataset.auth || 'required';
    try {
        if (mode === 'required') {
            const allowed = await requireAuth();
            if (!allowed) {
                return;
            }
        }
        await bootLayout();
        if (mode === 'required') {
            applyPermissionGuards();
            startIdleGuard();
        }
        document.dispatchEvent(new Event('hk:ready'));

        const pending = consumeFlash();
        if (pending?.message) {
            showToast(pending.message, pending.type || 'success');
        }
    } catch (error) {
        console.error(error);
        if (mode === 'required') {
            showToast(error?.message || 'Không tải được giao diện, vui lòng thử lại.', 'danger');
        }
    }
});
