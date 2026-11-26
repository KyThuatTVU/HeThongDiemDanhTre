export function init(root) {
    const icon = root.querySelector('[data-empty-icon]');
    if (icon && root.dataset.icon) {
        icon.className = `bi ${root.dataset.icon}`;
    }
    const title = root.querySelector('[data-empty-title]');
    if (title && root.dataset.title) {
        title.textContent = root.dataset.title;
    }
    const hint = root.querySelector('[data-empty-hint]');
    if (hint) {
        hint.textContent = root.dataset.hint || '';
        hint.hidden = !root.dataset.hint;
    }
}
