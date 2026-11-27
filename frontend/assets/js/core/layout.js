// Loader: gắn layout + component vào trang tĩnh (demo), thay cho include PHP khi ghép View
import { ROOT } from './config.js';
import { qsa, injectCss } from './dom.js';

const ASSET_VERSION = '20261127-20';
const TPL_CACHE_PREFIX = `hk_tpl:${ASSET_VERSION}:`;
const htmlCache = new Map();

function pruneOldTemplateCache() {
    try {
        for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('hk_tpl:') && !key.startsWith(TPL_CACHE_PREFIX)) {
                sessionStorage.removeItem(key);
            }
        }
    } catch {
        // Bỏ qua nếu trình duyệt chặn storage
    }
}

pruneOldTemplateCache();

function versioned(path) {
    const url = new URL(path, ROOT);
    url.searchParams.set('v', ASSET_VERSION);
    return url.href;
}

async function fetchText(url) {
    if (htmlCache.has(url)) {
        return htmlCache.get(url);
    }
    const cacheKey = TPL_CACHE_PREFIX + url;
    try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached !== null) {
            htmlCache.set(url, cached);
            return cached;
        }
    } catch {
        // Bỏ qua
    }
    const response = await fetch(url, { credentials: 'same-origin', cache: 'default' });
    if (!response.ok) {
        throw new Error(`Không tải được ${url} (HTTP ${response.status})`);
    }
    const text = await response.text();
    htmlCache.set(url, text);
    try {
        sessionStorage.setItem(cacheKey, text);
    } catch {
        // Bỏ qua nếu đầy sessionStorage
    }
    return text;
}

async function mountComponent(placeholder) {
    const name = placeholder.dataset.component;
    if (!name || placeholder.dataset.mounted === 'true') {
        return;
    }

    const slotTemplates = Array.from(placeholder.children)
        .filter((child) => child.tagName === 'TEMPLATE' && child.dataset.slot);

    const html = await fetchText(versioned(`components/${name}/${name}.html`));
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

    injectCss(versioned(`components/${name}/${name}.css`), `component-${name}`);

    try {
        const module = await import(versioned(`components/${name}/${name}.js`));
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
        const html = await fetchText(versioned(`layouts/${layoutName}.html`));
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
