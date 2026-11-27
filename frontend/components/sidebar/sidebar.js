import { session, can } from '../../assets/js/core/auth.js';

export function init(root) {
    const activeKey = document.body.dataset.page || '';
    const isAttendanceSheet = window.location.pathname.includes('attendance-sheet')
        || window.location.pathname.includes('/attendance/sheet');

    root.querySelectorAll('.sidebar__link').forEach((link) => {
        const permission = link.dataset.permission;
        if (permission && !can(permission)) {
            link.hidden = true;
            return;
        }
        if (link.dataset.nav && link.dataset.nav === activeKey) {
            link.classList.add('is-active');
            link.setAttribute('aria-current', 'page');
        }
    });

    root.querySelectorAll('.mobile-nav__item[data-mobile-nav]').forEach((item) => {
        const permission = item.dataset.permission;
        if (permission && !can(permission)) {
            item.hidden = true;
            return;
        }
        const key = item.dataset.mobileNav;
        const matched = isAttendanceSheet
            ? key === 'attendance-sheet'
            : (key === activeKey);
        if (matched) {
            item.classList.add('is-active');
            item.setAttribute('aria-current', 'page');
        }
    });

    root.addEventListener('click', (event) => {
        if (event.target.closest('[data-action="close-sidebar"]')) {
            document.querySelector('.app-shell')?.classList.remove('sidebar-open');
        }
        if (event.target.closest('[data-action="open-sidebar"]')) {
            document.querySelector('.app-shell')?.classList.toggle('sidebar-open');
        }
        const link = event.target.closest('.sidebar__link');
        if (link && window.innerWidth < 992) {
            document.querySelector('.app-shell')?.classList.remove('sidebar-open');
        }
    });
}
