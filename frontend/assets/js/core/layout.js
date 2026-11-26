// Loader: gắn layout + component vào trang tĩnh (demo), thay cho include PHP khi ghép View
import { ROOT } from './config.js';
import { qsa, injectCss } from './dom.js';

const htmlCache = new Map();

async function fetchText(url) {
    if (!htmlCache.has(url)) {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error(`Không tải được ${url} (HTTP ${response.status})`);
        }
        htmlCache.set(url, await response.text());
    }
    return htmlCache.get(url);
}

async function mountComponent(placeholder) {
    const name = placeholder.dataset.component;
    if (!name || placeholder.dataset.mounted === 'true') {
        return;
    }

    const slotTemplates = Array.from(placeholder.children)
        .filter((child) => child.tagName === 'TEMPLATE' && child.dataset.slot);

    const html = await fetchText(new URL(`components/${name}/${name}.html`, ROOT).href);
    const holder = document.createElement('div');
    holder.innerHTML = html.trim();
    const fragment = document.createDocumentFragment();
    fragment.append(...holder.childNodes);

    for (const template of slotTemplates) {
        const target = fragment.querySelector(`[data-slot="${template.dataset.slot}"]`);
        if (target) {
            target.replaceChildren(template.content.cloneNode(true));
        }
    }

    placeholder.replaceChildren(fragment);
    placeholder.dataset.mounted = 'true';
    placeholder.classList.add('hk-component-slot');

    injectCss(new URL(`components/${name}/${name}.css`, ROOT).href, `component-${name}`);

    try {
        const module = await import(new URL(`components/${name}/${name}.js`, ROOT).href);
        if (typeof module.init === 'function') {
            await module.init(placeholder);
        }
    } catch (error) {
        console.error(`[component:${name}]`, error);
    }

    await mountWithin(placeholder);
}

export async function mountWithin(root) {
    const nodes = qsa('[data-component]', root).filter((node) => node.dataset.mounted !== 'true');
    for (const node of nodes) {
        await mountComponent(node);
    }
}

export async function bootLayout() {
    const host = document.querySelector('[data-layout]');
    if (host) {
        const layoutName = host.dataset.layout;
        const html = await fetchText(new URL(`layouts/${layoutName}.html`, ROOT).href);
        const holder = document.createElement('div');
        holder.innerHTML = html.trim();
        const fragment = document.createDocumentFragment();
        fragment.append(...holder.childNodes);

        const slot = fragment.querySelector('[data-slot="content"]');
        if (slot) {
            while (host.firstChild) {
                slot.appendChild(host.firstChild);
            }
        }
        host.replaceChildren(fragment);
        host.classList.add('hk-layout-root');
    }
    await mountWithin(document);
}
