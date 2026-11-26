import { PAGES, pageUrl } from '../../core/config.js';

const target = new URL(pageUrl(PAGES.tuitionList));
target.search = window.location.search;
window.location.replace(target.href);
