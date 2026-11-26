export function init(root) {
    const year = root.querySelector('[data-footer-year]');
    if (year) {
        year.textContent = String(new Date().getFullYear());
    }
}
