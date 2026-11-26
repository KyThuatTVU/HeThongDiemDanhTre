import { injectCss, escapeHtml } from '../../assets/js/core/dom.js';

injectCss(new URL('./modal.css', import.meta.url).href, 'component-modal');

let counter = 0;

export function createModal(options = {}) {
    const sizeClass = options.size ? ` modal-${options.size}` : '';
    const element = document.createElement('div');
    element.className = 'modal fade';
    element.id = `hk-modal-${++counter}`;
    element.tabIndex = -1;
    element.setAttribute('aria-hidden', 'true');
    element.innerHTML = `
        <div class="modal-dialog${sizeClass} modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title h5" data-modal-title></h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
                </div>
                <div class="modal-body" data-modal-body></div>
                <div class="modal-footer" data-modal-footer></div>
            </div>
        </div>`;
    document.body.appendChild(element);

    const titleNode = element.querySelector('[data-modal-title]');
    const bodyNode = element.querySelector('[data-modal-body]');
    const footerNode = element.querySelector('[data-modal-footer]');
    titleNode.textContent = options.title || '';

    const instance = new window.bootstrap.Modal(element);

    if (options.onHidden) {
        element.addEventListener('hidden.bs.modal', options.onHidden);
    }

    function fill(target, content) {
        if (content instanceof Node) {
            target.replaceChildren(content);
        } else if (Array.isArray(content)) {
            target.replaceChildren(...content.filter((node) => node instanceof Node));
        } else {
            target.innerHTML = content ?? '';
        }
    }

    return {
        el: element,
        body: bodyNode,
        footer: footerNode,
        setTitle(title) {
            titleNode.textContent = title || '';
        },
        setBody(content) {
            fill(bodyNode, content);
        },
        setFooter(content) {
            fill(footerNode, content);
        },
        show() {
            instance.show();
        },
        hide() {
            instance.hide();
        },
        destroy() {
            instance.dispose();
            element.remove();
        }
    };
}

export function confirmAction(options = {}) {
    return new Promise((resolve) => {
        const modal = createModal({
            title: options.title || 'Xác nhận thao tác',
            onHidden: () => {
                resolve(false);
                window.setTimeout(() => modal.destroy(), 150);
            }
        });

        const icon = document.createElement('div');
        icon.className = `hk-confirm__icon${options.tone === 'warning' ? ' hk-confirm__icon--warning' : ''}`;
        icon.innerHTML = `<i class="bi ${options.tone === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-octagon-fill'}"></i>`;

        const wrap = document.createElement('div');
        const message = document.createElement('p');
        message.className = 'hk-confirm__message';
        message.textContent = options.message || 'Bạn có chắc muốn thực hiện thao tác này?';
        wrap.append(icon, message);
        modal.setBody(wrap);

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn-hk-outline';
        cancel.textContent = options.cancelText || 'Huỷ';
        cancel.dataset.bsDismiss = 'modal';

        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = options.tone === 'warning' ? 'btn-accent' : 'btn btn-danger';
        confirm.textContent = options.confirmText || 'Xác nhận';
        confirm.addEventListener('click', () => {
            resolve(true);
            modal.hide();
        });

        modal.setFooter([cancel, confirm]);
        modal.show();
    });
}

export function showFormErrors(form, errors = {}) {
    form.querySelectorAll('.is-invalid').forEach((field) => field.classList.remove('is-invalid'));
    form.querySelectorAll('[data-error-for]').forEach((node) => node.remove());
    Object.entries(errors || {}).forEach(([field, messages]) => {
        const input = form.querySelector(`[name="${escapeHtml(field)}"]`);
        if (!input) {
            return;
        }
        input.classList.add('is-invalid');
        const feedback = document.createElement('div');
        feedback.className = 'invalid-feedback d-block';
        feedback.dataset.errorFor = field;
        feedback.textContent = Array.isArray(messages) ? messages.join(' ') : String(messages);
        input.closest('.hk-field, .mb-3, .form-group, .form-check')?.appendChild(feedback);
    });
}
