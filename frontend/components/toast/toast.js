import { injectCss } from '../../assets/js/core/dom.js';

injectCss(new URL('./toast.css', import.meta.url).href, 'component-toast');

const ICONS = {
    success: 'bi-check-circle-fill',
    danger: 'bi-exclamation-octagon-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill'
};

function host() {
    let node = document.querySelector('[data-toast-host]');
    if (!node) {
        node = document.createElement('div');
        node.className = 'hk-toast-host';
        node.dataset.toastHost = '';
        node.setAttribute('aria-live', 'polite');
        document.body.appendChild(node);
    }
    return node;
}

export function showToast(message, type = 'success', timeout = 4200) {
    if (!message) {
        return;
    }
    const toast = document.createElement('div');
    toast.className = `hk-toast hk-toast--${ICONS[type] ? type : 'success'}`;
    toast.setAttribute('role', 'status');

    const icon = document.createElement('i');
    icon.className = `bi ${ICONS[type] || ICONS.success} hk-toast__icon`;

    const text = document.createElement('div');
    text.className = 'hk-toast__message';
    text.textContent = message;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'hk-toast__close';
    close.setAttribute('aria-label', 'Đóng thông báo');
    close.innerHTML = '<i class="bi bi-x-lg"></i>';

    const remove = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(6px)';
        toast.style.transition = 'opacity .18s ease, transform .18s ease';
        window.setTimeout(() => toast.remove(), 200);
    };

    close.addEventListener('click', remove);
    toast.append(icon, text, close);
    host().appendChild(toast);
    window.setTimeout(remove, timeout);
}
