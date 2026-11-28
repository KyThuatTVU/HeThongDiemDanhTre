// Tiện ích xuất/lưu/chia sẻ ảnh PNG tối ưu cho Android, iPhone/iPad và Máy tính
import { showToast } from '../../../components/toast/toast.js';
import { createModal } from '../../../components/modal/modal.js';

export function isIosDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/i.test(ua)
        || (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
}

export function isAndroidDevice() {
    return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
}

export function canSharePngFiles() {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof File !== 'function') {
        return false;
    }
    try {
        if (typeof navigator.canShare !== 'function') {
            return false;
        }
        const probe = new File([''], 'probe.png', { type: 'image/png' });
        return navigator.canShare({ files: [probe] });
    } catch {
        return false;
    }
}

export function canCopyPngToClipboard() {
    return typeof navigator !== 'undefined'
        && typeof navigator.clipboard?.write === 'function'
        && typeof window.ClipboardItem === 'function';
}

export function triggerFileDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function openIosSaveModal(blob, filename, title = 'Lưu ảnh vào Thư viện Ảnh (iPhone/iPad)') {
    const objectUrl = URL.createObjectURL(blob);
    const modal = createModal({
        title,
        size: 'lg',
        onHidden: () => {
            URL.revokeObjectURL(objectUrl);
            modal.el.remove();
        }
    });

    const body = document.createElement('div');
    body.innerHTML = `
        <p class="mb-2 text-muted-2 fs-13">
            Nhấn giữ trực tiếp vào ảnh bên dưới rồi chọn <strong>"Lưu vào Ảnh"</strong> (hoặc <strong>"Thêm vào Ảnh"</strong>) để lưu thẳng vào Thư viện ảnh.
        </p>
        <div class="text-center">
            <img src="${objectUrl}" alt="Ảnh phiếu xuất" style="max-width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;">
        </div>`;
    modal.setBody(body);

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'btn-hk-outline';
    downloadBtn.innerHTML = '<i class="bi bi-download me-1"></i>Tải tệp PNG';
    downloadBtn.addEventListener('click', () => {
        triggerFileDownload(blob, filename);
        showToast(`Đã tải tệp ${filename}`, 'success');
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-hk';
    closeBtn.textContent = 'Đóng';
    closeBtn.dataset.bsDismiss = 'modal';

    modal.setFooter([downloadBtn, closeBtn]);
    modal.show();
}

export async function savePngToDevice(blob, filename, title = 'Phiếu điểm danh') {
    if (!blob) return;

    // Trên iPhone/iPad: ưu tiên mở bảng chia sẻ gốc của iOS (có sẵn "Lưu hình ảnh" vào Photos & "Zalo");
    // nếu chạy HTTP không hỗ trợ thì mở ảnh để nhấn giữ -> Lưu vào Ảnh.
    if (isIosDevice()) {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title });
                return;
            } catch (err) {
                if (err?.name === 'AbortError') return;
            }
        }
        openIosSaveModal(blob, filename);
        return;
    }

    // Trên Android & Máy tính: tải trực tiếp 1 chạm (Android tự hiện ngay trong Bộ sưu tập / album Download)
    triggerFileDownload(blob, filename);
    const msg = isAndroidDevice()
        ? 'Đã lưu ảnh vào mục Download / Bộ sưu tập trên máy'
        : `Đã lưu ảnh ${filename}`;
    showToast(msg, 'success');
}

export async function sharePngFile(blob, filename, title = 'Phiếu điểm danh') {
    if (!blob) return;
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title });
            return;
        } catch (err) {
            if (err?.name === 'AbortError') return;
        }
    }
    if (isIosDevice()) {
        openIosSaveModal(blob, filename);
        return;
    }
    triggerFileDownload(blob, filename);
    showToast(`Đã lưu ảnh ${filename}`, 'success');
}

export async function copyPngBlob(blob, filename) {
    if (!blob) return;
    try {
        await navigator.clipboard.write([
            new window.ClipboardItem({ 'image/png': blob })
        ]);
        showToast('Đã sao chép ảnh — dán trực tiếp (Ctrl+V) vào Zalo để gửi ngay!', 'success');
    } catch {
        triggerFileDownload(blob, filename);
        showToast('Trình duyệt không cho phép copy ảnh, đã tự động lưu tệp PNG.', 'info');
    }
}
