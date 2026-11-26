export function init(root) {
    const active = root.dataset.active || '';
    root.querySelectorAll('[data-report-tab]').forEach((link) => {
        const isActive = link.dataset.reportTab === active;
        link.classList.toggle('is-active', isActive);
        if (isActive) {
            link.setAttribute('aria-current', 'page');
        }
    });
}
