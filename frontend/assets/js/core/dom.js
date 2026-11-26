// Tiện ích DOM dùng chung
export function qs(selector, root = document) {
    return root.querySelector(selector);
}

export function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
}

export function on(target, eventName, handler, options) {
    if (!target) {
        return () => {};
    }
    target.addEventListener(eventName, handler, options);
    return () => target.removeEventListener(eventName, handler, options);
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function setLoading(button, loading, loadingText = 'Đang xử lý...') {
    if (!button) {
        return;
    }
    if (loading) {
        button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${loadingText}`;
    } else {
        button.disabled = false;
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
            delete button.dataset.originalHtml;
        }
    }
}

export function debounce(fn, wait = 300) {
    let timer = null;
    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), wait);
    };
}

export function queryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

export function show(element, visible = true) {
    if (element) {
        element.hidden = !visible;
    }
}

export function injectCss(href, key = href) {
    if (document.querySelector(`link[data-hk-css="${key}"]`)) {
        return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.hkCss = key;
    document.head.appendChild(link);
}

export function componentAsset(metaUrl, componentName, fileName) {
    return new URL(`../../../components/${componentName}/${fileName}`, metaUrl).href;
}
