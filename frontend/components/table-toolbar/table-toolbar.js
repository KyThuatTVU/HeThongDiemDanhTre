export function init(root) {
    root.addEventListener('submit', (event) => {
        const form = event.target.closest('form');
        if (!form) {
            return;
        }
        event.preventDefault();
        root.dispatchEvent(new CustomEvent('hk:toolbar-submit', {
            bubbles: true,
            detail: { form }
        }));
    });

    const search = root.querySelector('[data-search-input]');
    if (search) {
        let timer = null;
        search.addEventListener('input', () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                root.dispatchEvent(new CustomEvent('hk:toolbar-search', {
                    bubbles: true,
                    detail: { value: search.value.trim() }
                }));
            }, 350);
        });
    }
}
