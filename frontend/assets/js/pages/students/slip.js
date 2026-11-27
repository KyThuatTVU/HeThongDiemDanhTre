import { api } from '../../core/http.js';
import { can, session } from '../../core/auth.js';
import { showToast } from '../../../../components/toast/toast.js';
import { date, money, number, percent, statusMeta, todayIso } from '../../core/format.js';
import { escapeHtml, qs, queryParam } from '../../core/dom.js';

const STATUS_MARKS = {
    present: { symbol: '✓', cls: 'present', color: '#15803d', bg: '#f0fdf4', border: '#86efac', label: 'Có mặt' },
    late: { symbol: 'M', cls: 'late', color: '#d97706', bg: '#fffbeb', border: '#fcd34d', label: 'Đi trễ' },
    excused_absent: { symbol: 'P', cls: 'excused', color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', label: 'Vắng phép' },
    unexcused_absent: { symbol: 'K', cls: 'unexcused', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', label: 'Vắng KP' },
    planned_leave: { symbol: 'N', cls: 'planned', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', label: 'Nghỉ báo' }
};

const now = new Date();
const state = {
    studentId: Number(queryParam('id') || 0),
    year: Number(queryParam('year') || now.getFullYear()),
    month: Number(queryParam('month') || (now.getMonth() + 1)),
    students: [],
    data: null,
    showTuition: true,
    showNotes: true,
    comment: '',
    teacher: '',
    loading: false
};

const studentSelect = qs('[data-slip-student]');
const monthSelect = qs('[data-slip-month]');
const yearSelect = qs('[data-slip-year]');
const teacherInput = qs('[data-slip-teacher]');
const commentInput = qs('[data-slip-comment]');
const showTuitionCheck = qs('[data-slip-show-tuition]');
const showTuitionWrap = qs('[data-slip-tuition-wrap]');
const showNotesCheck = qs('[data-slip-show-notes]');
const previewHost = qs('[data-slip-preview]');
const prevBtn = qs('[data-slip-prev]');
const nextBtn = qs('[data-slip-next]');
const shareBtn = qs('[data-slip-share]');

function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function fillPeriodSelects() {
    if (monthSelect) {
        monthSelect.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">Tháng ${i + 1}</option>`).join('');
        monthSelect.value = String(state.month);
    }
    if (yearSelect) {
        const years = [];
        for (let offset = 2; offset >= -1; offset -= 1) {
            const y = now.getFullYear() - offset;
            years.push(`<option value="${y}">Năm ${y}</option>`);
        }
        yearSelect.innerHTML = years.join('');
        yearSelect.value = String(state.year);
    }
}

function syncUrl() {
    const url = new URL(window.location.href);
    if (state.studentId) {
        url.searchParams.set('id', String(state.studentId));
    }
    url.searchParams.set('year', String(state.year));
    url.searchParams.set('month', String(state.month));
    window.history.replaceState(null, '', url);
}

function syncNavButtons() {
    const idx = state.students.findIndex((s) => Number(s.id) === Number(state.studentId));
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.disabled = idx < 0 || idx >= state.students.length - 1;
}

async function loadStudents() {
    try {
        let items = [];
        if (can('students.view')) {
            const payload = await api.get('/students', { status: 'active', per_page: 200 });
            items = (payload?.data || []).map((s) => ({
                id: Number(s.id),
                full_name: s.full_name,
                student_code: s.student_code,
                class_name: s.class_name || ''
            }));
        } else if (can('attendance.view')) {
            const payload = await api.get('/attendance/board', { session_date: todayIso(), slot_name: 'Chính' });
            items = (payload?.data?.students || []).map((s) => ({
                id: Number(s.student_id),
                full_name: s.full_name,
                student_code: s.student_code,
                class_name: s.class_name || ''
            }));
        }
        items.sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
        state.students = items;

        if (!items.length) {
            studentSelect.innerHTML = '<option value="">Chưa có học viên nào</option>';
            previewHost.innerHTML = '<div class="slip-state">Chưa có học viên trong cơ sở đang chọn.</div>';
            return false;
        }

        studentSelect.innerHTML = items.map((s) => {
            const cls = s.class_name ? ` · ${s.class_name}` : '';
            return `<option value="${s.id}">${escapeHtml(s.full_name)}${escapeHtml(cls)} (${escapeHtml(s.student_code)})</option>`;
        }).join('');

        const exists = items.some((s) => Number(s.id) === Number(state.studentId));
        if (!exists) {
            state.studentId = items[0].id;
        }
        studentSelect.value = String(state.studentId);
        syncNavButtons();
        return true;
    } catch (error) {
        studentSelect.innerHTML = '<option value="">Không tải được danh sách học viên</option>';
        showToast(error.message || 'Không tải được danh sách học viên', 'danger');
        return false;
    }
}

function tuitionStatusLabel(tuition) {
    if (!tuition) return '';
    if (tuition.status === 'reference') return 'Mức học phí thoả thuận (chưa lập phiếu thu tháng)';
    return statusMeta('tuition', tuition.status).label;
}

function collectNoteItems(data) {
    const notesObj = data?.attendance?.notes || {};
    const daysObj = data?.attendance?.days || {};
    const month = data?.period?.month || state.month;
    return Object.entries(notesObj)
        .map(([day, text]) => ({
            day: Number(day),
            status: daysObj[day] || daysObj[Number(day)] || null,
            text: String(text || '').trim()
        }))
        .filter((item) => item.text !== '')
        .sort((a, b) => a.day - b.day)
        .map((item) => {
            const mark = item.status ? STATUS_MARKS[item.status] : null;
            const prefix = `Ngày ${String(item.day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
            return `${prefix}${mark ? ` (${mark.label})` : ''}: ${item.text}`;
        });
}

function renderPreview() {
    const data = state.data;
    if (!data) {
        return;
    }
    const center = data.center || {};
    const branch = data.branch || {};
    const st = data.student || {};
    const period = data.period || {};
    const att = data.attendance || {};
    const summary = att.summary || {};
    const daysObj = att.days || {};
    const sundays = new Set((period.sundays || []).map(Number));
    const monthStr = `${String(period.month).padStart(2, '0')}/${period.year}`;

    if (showTuitionWrap) {
        showTuitionWrap.hidden = !data.can_view_tuition;
    }

    const orgLine = [center.name || 'Trung tâm HappyKidsCK', branch.name || ''].filter(Boolean).join(' · ');
    const contactParts = [];
    if (center.address) contactParts.push(center.address);
    if (center.hotline) contactParts.push(`Hotline: ${center.hotline}`);

    const firstOffset = Math.max(0, Number(period.first_iso_dow || 1) - 1);
    const daysInMonth = Number(period.days_in_month || 30);
    const dows = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    const calCells = dows.map((d, i) => `<div class="slip-cal__dow${i === 6 ? ' is-sun' : ''}">${d}</div>`);
    for (let i = 0; i < firstOffset; i += 1) {
        calCells.push('<div class="slip-cal__cell slip-cal__cell--empty"></div>');
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
        const status = daysObj[d] || daysObj[String(d)] || null;
        const mark = status ? STATUS_MARKS[status] : null;
        const cls = ['slip-cal__cell'];
        if (mark) {
            cls.push(`slip-cal__cell--${mark.cls}`);
        } else if (sundays.has(d)) {
            cls.push('slip-cal__cell--sun');
        }
        calCells.push(`
            <div class="${cls.join(' ')}" title="Ngày ${d}/${period.month}${mark ? `: ${mark.label}` : ''}">
                <span class="slip-cal__day">${d}</span>
                <span class="slip-cal__mark">${mark ? mark.symbol : ''}</span>
            </div>`);
    }

    const noteItems = state.showNotes ? collectNoteItems(data) : [];
    const notesSection = noteItems.length
        ? `<div>
            <h3 class="slip-section-title">Ghi chú chuyên cần trong tháng</h3>
            <ul class="slip-notes-list">${noteItems.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
        </div>`
        : '';

    const tuition = (data.can_view_tuition && state.showTuition) ? data.tuition : null;
    const tuitionSection = tuition
        ? `<div>
            <h3 class="slip-section-title">
                <span>Thông tin học phí tháng ${escapeHtml(monthStr)}</span>
                <span class="hk-chip">${escapeHtml(tuitionStatusLabel(tuition))}</span>
            </h3>
            <div class="slip-tuition">
                <div class="slip-tuition__row"><span>Học phí gốc / thoả thuận</span><strong>${escapeHtml(money(tuition.base_amount))}</strong></div>
                ${Number(tuition.adjustment_total || 0) !== 0
                    ? `<div class="slip-tuition__row"><span>Điều chỉnh / giảm trừ</span><strong>${escapeHtml(money(tuition.adjustment_total))}</strong></div>`
                    : ''}
                <div class="slip-tuition__row slip-tuition__row--total"><span>Tổng học phí tháng</span><strong>${escapeHtml(money(tuition.final_amount))}</strong></div>
                ${tuition.exists
                    ? `<div class="slip-tuition__row"><span>Đã thanh toán</span><strong class="money-positive">${escapeHtml(money(tuition.paid_amount))}</strong></div>
                       <div class="slip-tuition__row"><span>Còn lại</span><strong class="${Number(tuition.remaining_amount) > 0 ? 'money-danger' : 'money-positive'}">${escapeHtml(money(tuition.remaining_amount))}</strong></div>`
                    : ''}
            </div>
        </div>`
        : '';

    const commentText = state.comment.trim();
    const commentSection = commentText
        ? `<div>
            <h3 class="slip-section-title">Nhận xét gửi phụ huynh</h3>
            <div class="slip-comment-box">${escapeHtml(commentText)}</div>
        </div>`
        : '';

    const excusedPlusPlanned = Number(summary.excused_absent || 0) + Number(summary.planned_leave || 0);
    const rateText = summary.attendance_rate !== null && summary.attendance_rate !== undefined
        ? `Chuyên cần: ${percent(summary.attendance_rate)}`
        : 'Chưa có dữ liệu điểm danh';

    const todayParts = todayIso().split('-');
    const dateLabel = `Ngày ${todayParts[2]} tháng ${todayParts[1]} năm ${todayParts[0]}`;
    const teacherName = state.teacher.trim() || session.user?.full_name || 'Giáo viên phụ trách';

    previewHost.innerHTML = `
        <header class="slip-head">
            <p class="slip-head__org">${escapeHtml(orgLine)}</p>
            <h2 class="slip-head__title">PHIẾU THỐNG KÊ HỌC VIÊN · THÁNG ${escapeHtml(monthStr)}</h2>
            ${contactParts.length ? `<p class="slip-head__sub">${escapeHtml(contactParts.join(' · '))}</p>` : ''}
        </header>
        <div class="slip-body">
            <section class="slip-student-box">
                <div class="slip-student-box__top">
                    <h3 class="slip-student-box__name">${escapeHtml(st.full_name || '—')}</h3>
                    <span class="slip-student-box__code">${escapeHtml(st.student_code || '')}</span>
                </div>
                <div class="slip-student-box__meta">
                    <div>Lớp: <strong>${escapeHtml(st.class_name || 'Chưa xếp lớp')}</strong></div>
                    <div>Hình thức: <strong>${escapeHtml(st.study_format || '—')}</strong></div>
                    ${st.guardian_name ? `<div>Phụ huynh: <strong>${escapeHtml(st.guardian_name)}</strong></div>` : ''}
                    ${st.guardian_phone ? `<div>SĐT: <strong>${escapeHtml(st.guardian_phone)}</strong></div>` : ''}
                </div>
            </section>

            <section class="slip-kpis">
                <div class="slip-kpi slip-kpi--present">
                    <span class="slip-kpi__label">Đi học (buổi)</span>
                    <strong class="slip-kpi__value">${number(summary.present_total || 0)}</strong>
                </div>
                <div class="slip-kpi slip-kpi--late">
                    <span class="slip-kpi__label">Đi trễ</span>
                    <strong class="slip-kpi__value">${number(summary.late || 0)}</strong>
                </div>
                <div class="slip-kpi slip-kpi--excused">
                    <span class="slip-kpi__label">Vắng phép / báo</span>
                    <strong class="slip-kpi__value">${number(excusedPlusPlanned)}</strong>
                </div>
                <div class="slip-kpi slip-kpi--unexcused">
                    <span class="slip-kpi__label">Vắng không phép</span>
                    <strong class="slip-kpi__value">${number(summary.unexcused_absent || 0)}</strong>
                </div>
            </section>

            <section>
                <h3 class="slip-section-title">
                    <span>Lịch điểm danh tháng ${escapeHtml(monthStr)}</span>
                    <span class="hk-chip">${escapeHtml(rateText)}</span>
                </h3>
                <div class="slip-cal">${calCells.join('')}</div>
                <div class="slip-legend">
                    <span><strong style="color:#15803d">✓</strong> Có mặt</span>
                    <span><strong style="color:#d97706">M</strong> Đi trễ</span>
                    <span><strong style="color:#0369a1">P</strong> Vắng phép</span>
                    <span><strong style="color:#dc2626">K</strong> Vắng KP</span>
                    <span><strong style="color:#64748b">N</strong> Nghỉ báo trước</span>
                </div>
            </section>

            ${notesSection}
            ${tuitionSection}
            ${commentSection}

            <footer class="slip-footer">
                <div>Cảm ơn quý phụ huynh đã đồng hành cùng trung tâm!</div>
                <div class="slip-footer__sign">
                    <span>${escapeHtml(dateLabel)}</span>
                    <strong>${escapeHtml(teacherName)}</strong>
                </div>
            </footer>
        </div>`;
}

async function loadSlip() {
    if (!state.studentId) {
        return;
    }
    state.loading = true;
    previewHost.innerHTML = `<div class="slip-state">
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Đang tải phiếu thống kê tháng ${state.month}/${state.year}...
    </div>`;
    try {
        const payload = await api.get(`/students/${state.studentId}/parent-slip`, {
            year: state.year,
            month: state.month
        }, { cancelKey: 'student:slip' });
        state.data = payload?.data || null;
        renderPreview();
        syncUrl();
        syncNavButtons();
    } catch (error) {
        if (error?.superseded) {
            return;
        }
        previewHost.innerHTML = `<div class="slip-state text-danger">
            <i class="bi bi-exclamation-triangle me-1"></i>${escapeHtml(error.message || 'Không tải được phiếu thống kê')}
        </div>`;
        showToast(error.message || 'Không tải được phiếu thống kê', 'danger');
    } finally {
        state.loading = false;
    }
}

function drawRoundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
    const paragraphs = String(text || '').split('\n');
    const lines = [];
    paragraphs.forEach((para) => {
        const words = para.trim().split(/\s+/).filter(Boolean);
        if (!words.length) {
            return;
        }
        let current = words[0];
        for (let i = 1; i < words.length; i += 1) {
            const next = `${current} ${words[i]}`;
            if (ctx.measureText(next).width <= maxWidth) {
                current = next;
            } else {
                lines.push(current);
                current = words[i];
            }
        }
        lines.push(current);
    });
    return lines;
}

async function buildPngBlob() {
    const data = state.data;
    if (!data) {
        showToast('Chưa có dữ liệu phiếu để xuất ảnh', 'warning');
        return null;
    }
    if (document.fonts?.ready) {
        try {
            await document.fonts.ready;
        } catch {
            // Tiếp tục với font hệ thống
        }
    }

    const center = data.center || {};
    const branch = data.branch || {};
    const st = data.student || {};
    const period = data.period || {};
    const att = data.attendance || {};
    const summary = att.summary || {};
    const daysObj = att.days || {};
    const sundays = new Set((period.sundays || []).map(Number));
    const monthStr = `${String(period.month).padStart(2, '0')}/${period.year}`;

    const W = 720;
    const padX = 28;
    const contentW = W - padX * 2;
    const fontStack = '"Quicksand", "Be Vietnam Pro", Arial, sans-serif';

    // Đo trước chiều cao các phần động
    const measureCanvas = document.createElement('canvas');
    const mCtx = measureCanvas.getContext('2d');

    const firstOffset = Math.max(0, Number(period.first_iso_dow || 1) - 1);
    const daysInMonth = Number(period.days_in_month || 30);
    const calRows = Math.ceil((firstOffset + daysInMonth) / 7);

    const noteItems = state.showNotes ? collectNoteItems(data) : [];
    mCtx.font = `500 13.5px ${fontStack}`;
    const noteLines = [];
    noteItems.forEach((item) => {
        const wrapped = wrapLines(mCtx, `• ${item}`, contentW - 24);
        noteLines.push(...wrapped);
    });

    const tuition = (data.can_view_tuition && state.showTuition) ? data.tuition : null;
    const tuitionRows = [];
    if (tuition) {
        tuitionRows.push({ label: 'Học phí gốc / thoả thuận', value: money(tuition.base_amount), bold: false, color: '#0f172a' });
        if (Number(tuition.adjustment_total || 0) !== 0) {
            tuitionRows.push({ label: 'Điều chỉnh / giảm trừ', value: money(tuition.adjustment_total), bold: false, color: '#0f172a' });
        }
        tuitionRows.push({ label: 'Tổng học phí tháng', value: money(tuition.final_amount), bold: true, color: '#0f172a', bg: '#f8fafc' });
        if (tuition.exists) {
            tuitionRows.push({ label: 'Đã thanh toán', value: money(tuition.paid_amount), bold: true, color: '#15803d' });
            tuitionRows.push({
                label: 'Còn lại',
                value: money(tuition.remaining_amount),
                bold: true,
                color: Number(tuition.remaining_amount) > 0 ? '#dc2626' : '#15803d'
            });
        }
    }

    const commentText = state.comment.trim();
    mCtx.font = `500 14px ${fontStack}`;
    const commentLines = commentText ? wrapLines(mCtx, commentText, contentW - 32) : [];

    const hasGuardianRow = Boolean(st.guardian_name || st.guardian_phone);
    const headerH = (center.address || center.hotline) ? 106 : 88;
    const studentBoxH = hasGuardianRow ? 106 : 82;
    const kpiH = 74;
    const calCellH = 48;
    const calGap = 6;
    const calSectionH = 30 + 24 + calRows * calCellH + (calRows - 1) * calGap + 28;
    const notesSectionH = noteLines.length ? (30 + noteLines.length * 20 + 16) : 0;
    const tuitionSectionH = tuitionRows.length ? (32 + tuitionRows.length * 38 + 14) : 0;
    const commentSectionH = commentLines.length ? (30 + commentLines.length * 21 + 26) : 0;
    const footerH = 70;

    const totalH = headerH + 22 + studentBoxH + 18 + kpiH + 22 + calSectionH
        + (notesSectionH ? notesSectionH + 14 : 0)
        + (tuitionSectionH ? tuitionSectionH + 14 : 0)
        + (commentSectionH ? commentSectionH + 14 : 0)
        + footerH + 18;

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = Math.ceil(totalH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        showToast('Trình duyệt không hỗ trợ xuất ảnh PNG', 'danger');
        return null;
    }
    ctx.scale(scale, scale);

    // Nền trắng toàn phiếu
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, totalH);

    // 1. Header xanh teal
    ctx.fillStyle = '#0e5347';
    ctx.fillRect(0, 0, W, headerH);

    const orgLine = [center.name || 'Trung tâm HappyKidsCK', branch.name || ''].filter(Boolean).join(' · ').toUpperCase();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fbbf24';
    ctx.font = `700 12.5px ${fontStack}`;
    ctx.fillText(orgLine, W / 2, 26);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 22px ${fontStack}`;
    ctx.fillText(`PHIẾU THỐNG KÊ HỌC VIÊN · THÁNG ${monthStr}`, W / 2, 56);

    const contactParts = [];
    if (center.address) contactParts.push(center.address);
    if (center.hotline) contactParts.push(`Hotline: ${center.hotline}`);
    if (contactParts.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.86)';
        ctx.font = `500 12.5px ${fontStack}`;
        ctx.fillText(contactParts.join(' · '), W / 2, 84);
    }

    let y = headerH + 22;

    // 2. Hộp thông tin học viên
    drawRoundedRect(ctx, padX, y, contentW, studentBoxH, 12);
    ctx.fillStyle = '#f7faf9';
    ctx.fill();
    ctx.strokeStyle = '#cce6de';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = `800 20px ${fontStack}`;
    ctx.fillText(st.full_name || '—', padX + 18, y + 28);

    // Mã học viên badge
    if (st.student_code) {
        ctx.font = `700 12.5px ${fontStack}`;
        const codeW = ctx.measureText(st.student_code).width + 20;
        drawRoundedRect(ctx, padX + contentW - codeW - 16, y + 16, codeW, 24, 12);
        ctx.fillStyle = '#dcf1ec';
        ctx.fill();
        ctx.fillStyle = '#0e5347';
        ctx.textAlign = 'center';
        ctx.fillText(st.student_code, padX + contentW - codeW / 2 - 16, y + 28);
    }

    ctx.textAlign = 'left';
    ctx.font = `600 13.5px ${fontStack}`;
    ctx.fillStyle = '#334155';
    ctx.fillText(`Lớp: ${st.class_name || 'Chưa xếp lớp'}`, padX + 18, y + 58);
    ctx.fillText(`Hình thức: ${st.study_format || '—'}`, padX + contentW / 2, y + 58);

    if (hasGuardianRow) {
        if (st.guardian_name) {
            ctx.fillText(`Phụ huynh: ${st.guardian_name}`, padX + 18, y + 84);
        }
        if (st.guardian_phone) {
            ctx.fillText(`SĐT: ${st.guardian_phone}`, st.guardian_name ? padX + contentW / 2 : padX + 18, y + 84);
        }
    }

    y += studentBoxH + 18;

    // 3. 4 ô thống kê chuyên cần
    const excusedPlusPlanned = Number(summary.excused_absent || 0) + Number(summary.planned_leave || 0);
    const kpis = [
        { label: 'Đi học (buổi)', val: number(summary.present_total || 0), bg: '#ecfdf5', border: '#bbf7d0', color: '#15803d' },
        { label: 'Đi trễ', val: number(summary.late || 0), bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
        { label: 'Vắng phép / báo', val: number(excusedPlusPlanned), bg: '#eff6ff', border: '#bfdbfe', color: '#0369a1' },
        { label: 'Vắng không phép', val: number(summary.unexcused_absent || 0), bg: '#fef2f2', border: '#fecaca', color: '#dc2626' }
    ];
    const kpiGap = 10;
    const kpiW = (contentW - kpiGap * 3) / 4;
    kpis.forEach((item, idx) => {
        const kx = padX + idx * (kpiW + kpiGap);
        drawRoundedRect(ctx, kx, y, kpiW, kpiH, 12);
        ctx.fillStyle = item.bg;
        ctx.fill();
        ctx.strokeStyle = item.border;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#475569';
        ctx.font = `600 12px ${fontStack}`;
        ctx.fillText(item.label, kx + kpiW / 2, y + 22);

        ctx.fillStyle = item.color;
        ctx.font = `800 24px ${fontStack}`;
        ctx.fillText(item.val, kx + kpiW / 2, y + 51);
    });

    y += kpiH + 22;

    // 4. Lịch điểm danh theo tuần
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0e5347';
    ctx.font = `700 14.5px ${fontStack}`;
    ctx.fillText(`Lịch điểm danh tháng ${monthStr}`, padX, y + 10);

    const rateText = summary.attendance_rate !== null && summary.attendance_rate !== undefined
        ? `Chuyên cần: ${percent(summary.attendance_rate)}`
        : 'Chưa có lượt điểm danh';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = `600 12.5px ${fontStack}`;
    ctx.fillText(rateText, padX + contentW, y + 10);

    y += 30;
    const cellW = (contentW - calGap * 6) / 7;
    const dows = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    ctx.textAlign = 'center';
    ctx.font = `700 12px ${fontStack}`;
    dows.forEach((label, i) => {
        ctx.fillStyle = i === 6 ? '#b91c1c' : '#64748b';
        ctx.fillText(label, padX + i * (cellW + calGap) + cellW / 2, y + 10);
    });

    y += 24;
    for (let d = 1; d <= daysInMonth; d += 1) {
        const slot = firstOffset + d - 1;
        const row = Math.floor(slot / 7);
        const col = slot % 7;
        const cx = padX + col * (cellW + calGap);
        const cy = y + row * (calCellH + calGap);
        const status = daysObj[d] || daysObj[String(d)] || null;
        const mark = status ? STATUS_MARKS[status] : null;

        drawRoundedRect(ctx, cx, cy, cellW, calCellH, 9);
        ctx.fillStyle = mark ? mark.bg : (sundays.has(d) ? '#f8fafc' : '#ffffff');
        ctx.fill();
        ctx.strokeStyle = mark ? mark.border : '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = `600 11px ${fontStack}`;
        ctx.fillText(String(d), cx + cellW / 2, cy + 14);

        if (mark) {
            ctx.fillStyle = mark.color;
            ctx.font = `800 16px ${fontStack}`;
            ctx.fillText(mark.symbol, cx + cellW / 2, cy + 34);
        }
    }

    y += calRows * calCellH + (calRows - 1) * calGap + 18;
    ctx.textAlign = 'left';
    ctx.font = `600 12px ${fontStack}`;
    ctx.fillStyle = '#475569';
    ctx.fillText('Ký hiệu:   ✓ Có mặt   |   M Đi trễ   |   P Vắng phép   |   K Vắng KP   |   N Nghỉ báo trước', padX, y);
    y += 22;

    // 5. Ghi chú ngày nghỉ
    if (noteLines.length) {
        ctx.fillStyle = '#0e5347';
        ctx.font = `700 14px ${fontStack}`;
        ctx.fillText('Ghi chú chuyên cần trong tháng', padX, y + 10);
        y += 28;
        ctx.fillStyle = '#334155';
        ctx.font = `500 13.5px ${fontStack}`;
        noteLines.forEach((line) => {
            ctx.fillText(line, padX + 8, y + 8);
            y += 20;
        });
        y += 14;
    }

    // 6. Học phí tháng
    if (tuitionRows.length) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0e5347';
        ctx.font = `700 14px ${fontStack}`;
        ctx.fillText(`Thông tin học phí tháng ${monthStr}`, padX, y + 10);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#475569';
        ctx.font = `600 12px ${fontStack}`;
        ctx.fillText(tuitionStatusLabel(tuition), padX + contentW, y + 10);
        y += 26;

        const boxH = tuitionRows.length * 38;
        drawRoundedRect(ctx, padX, y, contentW, boxH, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();

        tuitionRows.forEach((tr, idx) => {
            const ry = y + idx * 38;
            if (tr.bg) {
                ctx.fillStyle = tr.bg;
                ctx.fillRect(padX + 1, ry + 1, contentW - 2, 36);
            }
            if (idx > 0) {
                ctx.beginPath();
                ctx.moveTo(padX, ry);
                ctx.lineTo(padX + contentW, ry);
                ctx.strokeStyle = '#e2e8f0';
                ctx.stroke();
            }
            ctx.textAlign = 'left';
            ctx.fillStyle = '#334155';
            ctx.font = `${tr.bold ? '700' : '500'} 13.5px ${fontStack}`;
            ctx.fillText(tr.label, padX + 14, ry + 19);

            ctx.textAlign = 'right';
            ctx.fillStyle = tr.color;
            ctx.font = `700 14px ${fontStack}`;
            ctx.fillText(tr.value, padX + contentW - 14, ry + 19);
        });
        y += boxH + 20;
    }

    // 7. Nhận xét của giáo viên
    if (commentLines.length) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0e5347';
        ctx.font = `700 14px ${fontStack}`;
        ctx.fillText('Nhận xét gửi phụ huynh', padX, y + 10);
        y += 26;

        const cBoxH = commentLines.length * 21 + 22;
        drawRoundedRect(ctx, padX, y, contentW, cBoxH, 12);
        ctx.fillStyle = '#fffbeb';
        ctx.fill();
        ctx.strokeStyle = '#fde68a';
        ctx.stroke();

        ctx.fillStyle = '#78350f';
        ctx.font = `500 14px ${fontStack}`;
        commentLines.forEach((line, idx) => {
            ctx.fillText(line, padX + 16, y + 20 + idx * 21);
        });
        y += cBoxH + 18;
    }

    // 8. Chân phiếu
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(padX, y + 4);
    ctx.lineTo(padX + contentW, y + 4);
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();
    ctx.setLineDash([]);

    const todayParts = todayIso().split('-');
    const dateLabel = `Ngày ${todayParts[2]} tháng ${todayParts[1]} năm ${todayParts[0]}`;
    const teacherName = state.teacher.trim() || session.user?.full_name || 'Giáo viên phụ trách';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = `500 12.5px ${fontStack}`;
    ctx.fillText('Cảm ơn quý phụ huynh đã đồng hành cùng trung tâm!', padX, y + 36);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = `500 12.5px ${fontStack}`;
    ctx.fillText(dateLabel, padX + contentW, y + 26);

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 13.5px ${fontStack}`;
    ctx.fillText(teacherName, padX + contentW, y + 48);

    const filename = `phieu-thong-ke-${slugify(st.full_name || st.student_code || 'hoc-vien')}-${String(period.month).padStart(2, '0')}-${period.year}.png`;
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                showToast('Không tạo được tệp ảnh PNG', 'danger');
                resolve(null);
                return;
            }
            resolve({ blob, filename });
        }, 'image/png');
    });
}

async function downloadPng() {
    const result = await buildPngBlob();
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Đã tải ảnh ${result.filename}`, 'success');
}

async function sharePng() {
    const result = await buildPngBlob();
    if (!result) return;
    const file = new File([result.blob], result.filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: `Phiếu thống kê ${state.data?.student?.full_name || ''}`
            });
            return;
        } catch (err) {
            if (err?.name === 'AbortError') return;
        }
    }
    await downloadPng();
}

function bindEvents() {
    studentSelect?.addEventListener('change', () => {
        state.studentId = Number(studentSelect.value || 0);
        loadSlip();
    });
    prevBtn?.addEventListener('click', () => {
        const idx = state.students.findIndex((s) => Number(s.id) === Number(state.studentId));
        if (idx > 0) {
            state.studentId = state.students[idx - 1].id;
            studentSelect.value = String(state.studentId);
            loadSlip();
        }
    });
    nextBtn?.addEventListener('click', () => {
        const idx = state.students.findIndex((s) => Number(s.id) === Number(state.studentId));
        if (idx >= 0 && idx < state.students.length - 1) {
            state.studentId = state.students[idx + 1].id;
            studentSelect.value = String(state.studentId);
            loadSlip();
        }
    });
    monthSelect?.addEventListener('change', () => {
        state.month = Number(monthSelect.value);
        loadSlip();
    });
    yearSelect?.addEventListener('change', () => {
        state.year = Number(yearSelect.value);
        loadSlip();
    });
    teacherInput?.addEventListener('input', () => {
        state.teacher = teacherInput.value;
        renderPreview();
    });
    commentInput?.addEventListener('input', () => {
        state.comment = commentInput.value;
        renderPreview();
    });
    showTuitionCheck?.addEventListener('change', () => {
        state.showTuition = showTuitionCheck.checked;
        renderPreview();
    });
    showNotesCheck?.addEventListener('change', () => {
        state.showNotes = showNotesCheck.checked;
        renderPreview();
    });

    qs('[data-slip-png]')?.addEventListener('click', downloadPng);
    qs('[data-slip-print]')?.addEventListener('click', () => window.print());
    if (shareBtn && typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File === 'function') {
        shareBtn.hidden = false;
        shareBtn.addEventListener('click', sharePng);
    }
}

document.addEventListener('hk:ready', async () => {
    fillPeriodSelects();
    if (teacherInput && session.user?.full_name) {
        state.teacher = session.user.full_name;
        teacherInput.value = state.teacher;
    }
    bindEvents();
    const ok = await loadStudents();
    if (ok) {
        await loadSlip();
    }
});
