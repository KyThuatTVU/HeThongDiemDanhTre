// Tiện ích form: thu thập dữ liệu, hiển thị lỗi validate từ API
export function formValues(form) {
    const data = new FormData(form);
    const result = {};
    for (const [key, value] of data.entries()) {
        if (typeof value === 'string') {
            result[key] = value.trim();
        }
    }
    return result;
}

export function clearFormErrors(form) {
    form.querySelectorAll('.is-invalid').forEach((input) => {
        input.classList.remove('is-invalid');
        input.removeAttribute('aria-invalid');
    });
    form.querySelectorAll('[data-error-for]').forEach((node) => node.remove());
}

export function showFormErrors(form, errors = {}) {
    clearFormErrors(form);
    Object.entries(errors || {}).forEach(([field, messages]) => {
        const input = form.querySelector(`[name="${field}"]`);
        const text = Array.isArray(messages) ? messages.join(' ') : String(messages || '');
        if (!input) {
            return;
        }
        input.classList.add('is-invalid');
        input.setAttribute('aria-invalid', 'true');
        const feedback = document.createElement('div');
        feedback.className = 'invalid-feedback d-block';
        feedback.dataset.errorFor = field;
        feedback.textContent = text;
        const holder = input.closest('.hk-field') || input.parentElement;
        holder?.appendChild(feedback);
    });
}
