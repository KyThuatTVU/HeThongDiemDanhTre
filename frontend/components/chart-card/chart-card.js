export function init(root) {
    const title = root.querySelector('[data-chart-title]');
    if (title && root.dataset.title) {
        title.textContent = root.dataset.title;
    }
    const subtitle = root.querySelector('[data-chart-subtitle]');
    if (subtitle) {
        subtitle.textContent = root.dataset.subtitle || '';
        subtitle.hidden = !root.dataset.subtitle;
    }
}
