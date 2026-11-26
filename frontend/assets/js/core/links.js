// Chuyển link nội bộ sang URL thân thiện (ẩn cấu trúc frontend/pages)
import { PAGE_ROUTES } from './config.js';

const SLUG_BY_DIR = new Map(
    Object.values(PAGE_ROUTES).map((route) => [`frontend/pages/${route.dir}`, route.slug])
);

function friendlyPath(pathname) {
    const match = pathname.match(/^(.*?)\/frontend\/pages\/([a-z-]+)\/([a-z-]+)(?:\/index\.html)?\/?$/);
    if (!match) {
        return null;
    }
    const slug = SLUG_BY_DIR.get(`frontend/pages/${match[2]}/${match[3]}`);
    return slug ? `${match[1]}/${slug}/` : null;
}

export function friendlyUrl(value) {
    let parsed;
    try {
        parsed = new URL(value, document.baseURI);
    } catch {
        return null;
    }
    if (parsed.origin !== window.location.origin) {
        return null;
    }
    const path = friendlyPath(parsed.pathname);
    if (!path) {
        return null;
    }
    return `${path}${parsed.search}${parsed.hash}`;
}

const SKIP = /^(#|mailto:|tel:|javascript:|data:)/i;

function rewriteAnchor(anchor) {
    const raw = anchor.getAttribute('href');
    if (!raw || SKIP.test(raw)) {
        return;
    }
    const target = friendlyUrl(raw);
    if (target) {
        anchor.setAttribute('href', target);
    }
}

function rewriteWithin(node) {
    if (node.nodeType !== 1) {
        return;
    }
    if (node.matches?.('a[href]')) {
        rewriteAnchor(node);
    }
    node.querySelectorAll?.('a[href]').forEach(rewriteAnchor);
}

export function initFriendlyLinks() {
    rewriteWithin(document.documentElement);
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach(rewriteWithin);
        });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
}
