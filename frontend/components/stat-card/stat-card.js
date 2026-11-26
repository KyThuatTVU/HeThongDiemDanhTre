export function init(root) {
    const card = root.querySelector('.stat-card');
    if (!card) {
        return;
    }
    const tone = root.dataset.tone;
    if (tone) {
        card.classList.add(`stat-card--${tone}`);
    }
    const icon = root.querySelector('[data-stat-icon]');
    if (icon && root.dataset.icon) {
        icon.className = `bi ${root.dataset.icon}`;
    }
    const label = root.querySelector('[data-stat-label]');
    if (label && root.dataset.label) {
        label.textContent = root.dataset.label;
    }
    const value = root.querySelector('[data-stat-value]');
    if (value && root.dataset.value !== undefined) {
        value.textContent = root.dataset.value;
    }
    const hint = root.querySelector('[data-stat-hint]');
    if (hint) {
        hint.textContent = root.dataset.hint || '';
        hint.hidden = !root.dataset.hint;
    }
}
