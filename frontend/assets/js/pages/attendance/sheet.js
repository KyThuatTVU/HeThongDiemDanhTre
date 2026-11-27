import { api } from '../../core/http.js';
import { can, currentBranch } from '../../core/auth.js';
import { showToast } from '../../../../components/toast/toast.js';
import { money, number } from '../../core/format.js';
import { escapeHtml, qs } from '../../core/dom.js';

const STATUS_MARKS = {
    present: { symbol: '✓', cls: 'present', color: '#15803d', label: 'Có mặt' },
    excused_absent: { symbol: 'P', cls: 'excused', color: '#0369a1', label: 'Vắng có phép' },
    unexcused_absent: { symbol: 'K', cls: 'unexcused', color: '#dc2626', label: 'Vắng không phép' },
    late: { symbol: 'M', cls: 'late', color: '#d97706', label: 'Đi muộn' },
    planned_leave: { symbol: 'N', cls: 'planned', color: '#6b7280', label: 'Nghỉ báo trước' }
};

const now = new Date();
const state = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    classId: '',
    classes: [],
    teacher: '',
    assistant: '',
    feePerDay: 0,
    data: null,
    loading: false
};

const classTabsHost = qs('[data-sheet-class-tabs]');
const monthSelect = qs('[data-sheet-month]');
const yearSelect = qs('[data-sheet-year]');
const classSelect = qs('[data-sheet-class]');
const teacherInput = qs('[data-sheet-teacher]');
const assistantInput = qs('[data-sheet-assistant]');
const feeInput = qs('[data-sheet-fee-per-day]');
const tableWrap = qs('[data-sheet-table-wrap]');

const orgNode = qs('[data-sheet-org]');
const titleNode = qs('[data-sheet-title]');
const metaClass = qs('[data-meta-class]');
const metaMonth = qs('[data-meta-month]');
const metaTeacher = qs('[data-meta-teacher]');
const metaAssistant = qs('[data-meta-assistant]');
const summaryNode = qs('[data-sheet-summary]');

function fillPeriodSelects() {
    const months = [];
    for (let m = 1; m <= 12; m += 1) {
        months.push(`<option value="${m}">Tháng ${m}</option>`);
    }
    monthSelect.innerHTML = months.join('');
    monthSelect.value = String(state.month);

    const years = [];
    for (let offset = 2; offset >= -1; offset -= 1) {
        const y = now.getFullYear() - offset;
        years.push(`<option value="${y}">Năm ${y}</option>`);
    }
    yearSelect.innerHTML = years.join('');
    yearSelect.value = String(state.year);
}

function isPerClassDefaultBranch() {
    return String(currentBranch()?.code || '').toUpperCase() === 'CL';
}

function slugifyClass(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function syncUrlAndLinks() {
    const url = new URL(window.location.href);
    url.searchParams.set('year', String(state.year));
    url.searchParams.set('month', String(state.month));
    if (state.classId) {
        url.searchParams.set('class_id', state.classId);
    } else {
        url.searchParams.delete('class_id');
    }
    window.history.replaceState(null, '', url);

    document.querySelectorAll('a[href*="/attendance/"], a[href*="/attendance/today"]').forEach((anchor) => {
        const href = anchor.getAttribute('href') || '';
        if (href.includes('sheet') || href.includes('history')) return;
        const target = new URL(href, window.location.href);
        if (state.classId) {
            target.searchParams.set('class_id', state.classId);
        } else {
            target.searchParams.delete('class_id');
        }
        anchor.setAttribute('href', `${target.pathname}${target.search}`);
    });
}

function renderClassTabs() {
    if (!classTabsHost) {
        return;
    }
    const classItems = state.classes.map((item) => ({
        value: String(item.id),
        label: `${item.name}${item.status === 'inactive' ? ' (ngừng)' : ''}`,
        count: item.student_count ?? null
    }));
    const allItem = { value: '', label: 'Tất cả học viên', count: null };

    const items = isPerClassDefaultBranch()
        ? [...classItems, allItem]
        : [allItem, ...classItems, { value: 'unassigned', label: 'Chưa xếp lớp', count: null }];

    if (items.length <= 1) {
        classTabsHost.hidden = true;
        classTabsHost.innerHTML = '';
        return;
    }

    classTabsHost.hidden = false;
    classTabsHost.innerHTML = items.map((tab) => {
        const active = tab.value === state.classId;
        const countBadge = tab.count !== null && tab.count !== undefined
            ? `<span class="sheet-class-tab__count">${number(tab.count)}</span>`
            : '';
        return `<button type="button" class="sheet-class-tab${active ? ' is-active' : ''}"
            data-sheet-class-tab="${escapeHtml(tab.value)}" aria-pressed="${active ? 'true' : 'false'}">
            <span>${escapeHtml(tab.label)}</span>${countBadge}
        </button>`;
    }).join('');
}

async function loadClasses(hasExplicitClass = false) {
    if (!can('classes.view') || !classSelect) {
        return;
    }
    try {
        const payload = await api.get('/classes');
        state.classes = payload?.data || [];
        const options = ['<option value="">Tất cả học viên</option>'];
        state.classes.forEach((item) => {
            const count = item.student_count !== undefined ? ` (${item.student_count})` : '';
            options.push(
                `<option value="${item.id}">${escapeHtml(item.name)}${count}${item.status === 'inactive' ? ' (ngừng)' : ''}</option>`
            );
        });
        options.push('<option value="unassigned">Chưa xếp lớp</option>');
        classSelect.innerHTML = options.join('');

        // Cơ sở Càng Long: mặc định mở theo từng lớp riêng (chọn lớp đầu tiên)
        if (!hasExplicitClass && isPerClassDefaultBranch() && state.classes.length > 0) {
            state.classId = String(state.classes[0].id);
        }

        const validValues = new Set(['', 'unassigned', ...state.classes.map((item) => String(item.id))]);
        if (!validValues.has(state.classId)) {
            state.classId = '';
        }
        classSelect.value = state.classId;
        renderClassTabs();
    } catch {
        state.classes = [];
    }
}

function buildSheetHeaderTexts() {
    const data = state.data;
    const branchName = (data?.branch?.name || currentBranch()?.name || '').trim();
    const classLabel = (data?.class_label || 'Tất cả học viên').trim();
    const monthStr = `${String(state.month).padStart(2, '0')}/${state.year}`;

    const orgText = branchName
        ? `TRUNG TÂM HAPPYKIDSCK · ${branchName.toUpperCase()}`
        : 'TRUNG TÂM HAPPYKIDSCK';

    let subject = 'HỌC VIÊN';
    if (state.classId === 'unassigned') {
        subject = 'HỌC VIÊN CHƯA XẾP LỚP';
    } else if (state.classId !== '' && classLabel && classLabel !== 'Tất cả học viên') {
        subject = classLabel.toUpperCase();
    }
    const titleText = `BẢNG ĐIỂM DANH ${subject} — THÁNG ${monthStr}`;
    return { orgText, titleText, monthStr };
}

function renderMeta() {
    const data = state.data;
    const { orgText, titleText, monthStr } = buildSheetHeaderTexts();
    if (orgNode) {
        orgNode.textContent = orgText;
    }
    if (titleNode) {
        titleNode.textContent = titleText;
    }
    if (metaClass) {
        const branchName = data?.branch?.name || '';
        const classLabel = data?.class_label || 'Tất cả học viên';
        metaClass.textContent = branchName ? `${classLabel} · ${branchName}` : classLabel;
    }
    if (metaMonth) {
        metaMonth.textContent = monthStr;
    }
    if (metaTeacher) {
        metaTeacher.textContent = state.teacher.trim() || ' ';
    }
    if (metaAssistant) {
        metaAssistant.textContent = state.assistant.trim() || ' ';
    }
}

function renderSheet() {
    renderMeta();
    const data = state.data;
    if (!data) {
        return;
    }

    const daysInMonth = Number(data.days_in_month || 30);
    const sundays = new Set((data.sundays || []).map(Number));
    const students = data.students || [];
    const showClassSub = state.classId === '';
    const isCurrentMonth = state.year === now.getFullYear() && state.month === now.getMonth() + 1;
    const todayDay = isCurrentMonth ? now.getDate() : -1;

    if (!students.length) {
        tableWrap.innerHTML = '<div class="sheet-state">Chưa có học viên nào trong phạm vi đã chọn.</div>';
        if (summaryNode) summaryNode.textContent = '';
        return;
    }

    const dayHeaders = [];
    for (let d = 1; d <= daysInMonth; d += 1) {
        const classes = ['col-day'];
        if (sundays.has(d)) classes.push('is-sunday');
        if (d === todayDay) classes.push('is-today');
        dayHeaders.push(`<th class="${classes.join(' ')}" title="Ngày ${d}/${state.month}/${state.year}">${d}</th>`);
    }

    const bodyRows = students.map((student, index) => {
        const days = student.days || {};
        const notes = student.notes || {};
        const dayCells = [];
        for (let d = 1; d <= daysInMonth; d += 1) {
            const status = days[d] || days[String(d)] || null;
            const mark = status ? STATUS_MARKS[status] : null;
            const note = notes[d] || notes[String(d)] || '';
            const cls = sundays.has(d) ? 'col-day is-sunday' : 'col-day';
            const title = mark
                ? `Ngày ${d}/${state.month}: ${mark.label}${note ? ` (${note})` : ''}`
                : `Ngày ${d}/${state.month}`;
            const content = mark
                ? `<span class="sheet-mark sheet-mark--${mark.cls}">${mark.symbol}</span>`
                : '';
            dayCells.push(`<td class="${cls}" title="${escapeHtml(title)}">${content}</td>`);
        }

        const presentDays = Number(student.present_days || 0);
        const feePerDayText = state.feePerDay > 0 ? escapeHtml(money(state.feePerDay)) : '';
        let totalAmount = student.tuition_final_amount;
        if (state.feePerDay > 0 && presentDays > 0) {
            totalAmount = presentDays * state.feePerDay;
        }
        const totalAmountText = totalAmount !== null && totalAmount !== undefined && Number(totalAmount) > 0
            ? escapeHtml(money(totalAmount))
            : '';

        const classSub = showClassSub
            ? `<span class="sheet-student-sub">${escapeHtml(student.class_name || 'Chưa xếp lớp')}</span>`
            : '';

        const slipHref = `../../students/slip/?id=${student.student_id}&year=${state.year}&month=${state.month}`;
        return `<tr>
            <td class="col-stt">${index + 1}</td>
            <td class="col-name"><a class="sheet-student-name sheet-student-link" href="${slipHref}" title="Mở phiếu thống kê gửi phụ huynh">${escapeHtml(student.full_name)}</a>${classSub}</td>
            <td class="col-phone">${escapeHtml(student.guardian_phone || '')}</td>
            ${dayCells.join('')}
            <td class="col-total">${presentDays > 0 ? number(presentDays) : ''}</td>
            <td class="col-fee">${feePerDayText}</td>
            <td class="col-amount">${totalAmountText}</td>
        </tr>`;
    }).join('');

    tableWrap.innerHTML = `
        <table class="sheet-table">
            <thead>
                <tr>
                    <th class="col-stt">STT</th>
                    <th class="col-name">Họ và tên học sinh</th>
                    <th class="col-phone">SĐT PH</th>
                    ${dayHeaders.join('')}
                    <th class="col-total">Tổng<br>buổi học</th>
                    <th class="col-fee">Học phí<br>/buổi</th>
                    <th class="col-amount">Tổng học phí<br>tháng</th>
                </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
        </table>`;

    if (summaryNode) {
        const s = data.summary || {};
        summaryNode.textContent = `${number(s.total_students || 0)} học viên · ${number(s.present_total || 0)} lượt có mặt · ${number(s.absent_total || 0)} lượt vắng`;
    }
}

let sheetRequestSeq = 0;

async function loadSheet() {
    const seq = ++sheetRequestSeq;
    state.loading = true;
    tableWrap.innerHTML = `<div class="sheet-state">
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Đang tải phiếu điểm danh tháng ${state.month}/${state.year}...
    </div>`;
    try {
        const params = { year: state.year, month: state.month };
        if (state.classId) {
            params.class_id = state.classId;
        }
        const payload = await api.get('/attendance/monthly-sheet', params, { cancelKey: 'attendance:sheet' });
        if (seq !== sheetRequestSeq) {
            return;
        }
        state.data = payload?.data || null;
        renderSheet();
        syncUrlAndLinks();
    } catch (error) {
        if (error?.superseded || seq !== sheetRequestSeq) {
            return;
        }
        tableWrap.innerHTML = `<div class="sheet-state text-danger">
            <i class="bi bi-exclamation-triangle me-1"></i>${escapeHtml(error.message || 'Không tải được phiếu điểm danh tháng')}
        </div>`;
        showToast(error.message || 'Không tải được phiếu điểm danh tháng', 'danger');
    } finally {
        if (seq === sheetRequestSeq) {
            state.loading = false;
        }
    }
}

function fitText(ctx, text, maxWidth) {
    const str = String(text || '');
    if (ctx.measureText(str).width <= maxWidth) {
        return str;
    }
    let trimmed = str;
    while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
        trimmed = trimmed.slice(0, -1);
    }
    return `${trimmed}…`;
}

async function exportPng() {
    const data = state.data;
    if (!data || !(data.students || []).length) {
        showToast('Chưa có dữ liệu để tải ảnh', 'warning');
        return;
    }

    if (document.fonts && document.fonts.ready) {
        try {
            await document.fonts.ready;
        } catch {
            // Tiếp tục vẽ với font hệ thống
        }
    }

    const daysInMonth = Number(data.days_in_month || 30);
    const sundays = new Set((data.sundays || []).map(Number));
    const students = data.students || [];
    const showClassSub = state.classId === '';

    const padX = 24;
    const padY = 20;
    const titleH = 52;
    const metaH = 32;
    const theadH = 40;
    const rowH = 30;
    const legendH = 34;

    const colStt = 38;
    const colName = 195;
    const colPhone = 104;
    const colDay = 28;
    const colTotal = 64;
    const colFee = 86;
    const colAmount = 104;

    const tableW = colStt + colName + colPhone + (daysInMonth * colDay) + colTotal + colFee + colAmount;
    const width = tableW + padX * 2;
    const height = padY * 2 + titleH + metaH + theadH + (students.length * rowH) + legendH;

    // Đảm bảo không vượt quá giới hạn chiều cao canvas trình duyệt (~15,000px) kể cả khi >200 học sinh
    const scale = height * 2 <= 15000 ? 2 : (height * 1.5 <= 15000 ? 1.5 : 1);

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        showToast('Trình duyệt không hỗ trợ xuất ảnh PNG', 'danger');
        return;
    }
    ctx.scale(scale, scale);

    const fontStack = '"Quicksand", "Be Vietnam Pro", Arial, sans-serif';

    // Nền trắng
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Tiêu đề (Tên trung tâm + cơ sở + Tiêu đề lớp & tháng)
    const { orgText, titleText } = buildSheetHeaderTexts();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#12665a';
    ctx.font = `700 13px ${fontStack}`;
    ctx.fillText(orgText, width / 2, padY + 12);

    ctx.fillStyle = '#111827';
    ctx.font = `800 19px ${fontStack}`;
    ctx.fillText(titleText, width / 2, padY + 34);

    // Hàng thông tin (Lớp/Cơ sở | Tháng | Giáo viên | Trợ giảng)
    let y = padY + titleH;
    const branchName = data.branch?.name || '';
    const classLabel = data.class_label || 'Tất cả học viên';
    const metaItems = [
        { label: 'Lớp / Cơ sở: ', value: branchName ? `${classLabel} · ${branchName}` : classLabel, w: Math.round(tableW * 0.34) },
        { label: 'Tháng: ', value: `${String(state.month).padStart(2, '0')}/${state.year}`, w: Math.round(tableW * 0.14) },
        { label: 'Giáo viên: ', value: state.teacher.trim(), w: Math.round(tableW * 0.26) },
        { label: 'Trợ giảng: ', value: state.assistant.trim(), w: tableW - Math.round(tableW * 0.34) - Math.round(tableW * 0.14) - Math.round(tableW * 0.26) }
    ];

    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(padX, y, tableW, metaH);
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.strokeRect(padX + 0.5, y + 0.5, tableW - 1, metaH);

    let mx = padX;
    metaItems.forEach((item, idx) => {
        if (idx > 0) {
            ctx.beginPath();
            ctx.moveTo(mx + 0.5, y);
            ctx.lineTo(mx + 0.5, y + metaH);
            ctx.stroke();
        }
        ctx.textAlign = 'left';
        ctx.font = `600 13px ${fontStack}`;
        ctx.fillStyle = '#374151';
        const labelW = ctx.measureText(item.label).width;
        ctx.fillText(item.label, mx + 10, y + metaH / 2);

        ctx.font = `700 13px ${fontStack}`;
        ctx.fillStyle = '#111827';
        const valText = fitText(ctx, item.value, Math.max(20, item.w - labelW - 18));
        ctx.fillText(valText, mx + 10 + labelW, y + metaH / 2);
        mx += item.w;
    });

    // Header bảng
    y += metaH;
    const cols = [
        { key: 'stt', label: 'STT', w: colStt },
        { key: 'name', label: 'Họ và tên học sinh', w: colName },
        { key: 'phone', label: 'SĐT PH', w: colPhone }
    ];
    for (let d = 1; d <= daysInMonth; d += 1) {
        cols.push({ key: `d${d}`, day: d, label: String(d), w: colDay, isSunday: sundays.has(d) });
    }
    cols.push(
        { key: 'total', label: 'Tổng\nbuổi học', w: colTotal },
        { key: 'fee', label: 'Học phí\n/buổi', w: colFee },
        { key: 'amount', label: 'Tổng học phí\ntháng', w: colAmount }
    );

    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(padX, y, tableW, theadH);

    let x = padX;
    ctx.strokeStyle = '#6b7280';
    ctx.fillStyle = '#111827';
    ctx.font = `700 12px ${fontStack}`;
    ctx.textAlign = 'center';
    cols.forEach((col) => {
        if (col.isSunday) {
            ctx.fillStyle = '#e5e7eb';
            ctx.fillRect(x, y, col.w, theadH);
            ctx.fillStyle = '#111827';
        }
        ctx.strokeRect(x + 0.5, y + 0.5, col.w, theadH);
        const lines = col.label.split('\n');
        if (lines.length === 1) {
            ctx.fillText(lines[0], x + col.w / 2, y + theadH / 2);
        } else {
            ctx.fillText(lines[0], x + col.w / 2, y + theadH / 2 - 7);
            ctx.fillText(lines[1], x + col.w / 2, y + theadH / 2 + 8);
        }
        x += col.w;
    });

    // Các hàng học sinh
    y += theadH;
    students.forEach((student, idx) => {
        const days = student.days || {};
        const presentDays = Number(student.present_days || 0);
        const feePerDayText = state.feePerDay > 0 ? money(state.feePerDay) : '';
        let totalAmount = student.tuition_final_amount;
        if (state.feePerDay > 0 && presentDays > 0) {
            totalAmount = presentDays * state.feePerDay;
        }
        const totalAmountText = totalAmount !== null && totalAmount !== undefined && Number(totalAmount) > 0
            ? money(totalAmount)
            : '';

        let cx = padX;
        cols.forEach((col) => {
            if (col.isSunday) {
                ctx.fillStyle = '#f3f4f6';
                ctx.fillRect(cx, y, col.w, rowH);
            } else if (col.key === 'total') {
                ctx.fillStyle = '#fafafa';
                ctx.fillRect(cx, y, col.w, rowH);
            }
            ctx.strokeStyle = '#6b7280';
            ctx.strokeRect(cx + 0.5, y + 0.5, col.w, rowH);

            if (col.key === 'stt') {
                ctx.fillStyle = '#4b5563';
                ctx.font = `600 12px ${fontStack}`;
                ctx.textAlign = 'center';
                ctx.fillText(String(idx + 1), cx + col.w / 2, y + rowH / 2);
            } else if (col.key === 'name') {
                ctx.textAlign = 'left';
                const displayName = showClassSub
                    ? `${student.full_name} (${student.class_name || 'Chưa xếp lớp'})`
                    : student.full_name;
                ctx.fillStyle = '#111827';
                ctx.font = `600 12.5px ${fontStack}`;
                ctx.fillText(fitText(ctx, displayName, col.w - 14), cx + 7, y + rowH / 2);
            } else if (col.key === 'phone') {
                ctx.fillStyle = '#374151';
                ctx.font = `500 11.5px ${fontStack}`;
                ctx.textAlign = 'center';
                ctx.fillText(fitText(ctx, student.guardian_phone || '', col.w - 8), cx + col.w / 2, y + rowH / 2);
            } else if (col.day) {
                const status = days[col.day] || days[String(col.day)] || null;
                const mark = status ? STATUS_MARKS[status] : null;
                if (mark) {
                    ctx.fillStyle = mark.color;
                    ctx.font = `800 13.5px ${fontStack}`;
                    ctx.textAlign = 'center';
                    ctx.fillText(mark.symbol, cx + col.w / 2, y + rowH / 2);
                }
            } else if (col.key === 'total') {
                ctx.fillStyle = '#111827';
                ctx.font = `700 12.5px ${fontStack}`;
                ctx.textAlign = 'center';
                ctx.fillText(presentDays > 0 ? number(presentDays) : '', cx + col.w / 2, y + rowH / 2);
            } else if (col.key === 'fee') {
                ctx.fillStyle = '#374151';
                ctx.font = `500 11.5px ${fontStack}`;
                ctx.textAlign = 'right';
                ctx.fillText(fitText(ctx, feePerDayText, col.w - 10), cx + col.w - 5, y + rowH / 2);
            } else if (col.key === 'amount') {
                ctx.fillStyle = '#111827';
                ctx.font = `700 11.5px ${fontStack}`;
                ctx.textAlign = 'right';
                ctx.fillText(fitText(ctx, totalAmountText, col.w - 10), cx + col.w - 5, y + rowH / 2);
            }
            cx += col.w;
        });
        y += rowH;
    });

    // Viền ngoài đậm cho toàn bảng
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(padX + 0.5, padY + titleH + metaH + 0.5, tableW, theadH + students.length * rowH);

    // Chú thích cuối phiếu
    const legendY = y + legendH / 2 + 4;
    ctx.textAlign = 'left';
    ctx.font = `700 12.5px ${fontStack}`;
    ctx.fillStyle = '#374151';
    ctx.fillText('Ghi chú:   ✓ Có mặt   |   P Có phép   |   K Không phép   |   M Muộn   |   N Nghỉ báo trước', padX, legendY);

    const s = data.summary || {};
    ctx.textAlign = 'right';
    ctx.font = `700 12.5px ${fontStack}`;
    ctx.fillStyle = '#111827';
    ctx.fillText(
        `${number(s.total_students || 0)} học viên · ${number(s.present_total || 0)} lượt có mặt · ${number(s.absent_total || 0)} lượt vắng`,
        padX + tableW,
        legendY
    );

    const classSlug = state.classId ? slugifyClass(data.class_label) : 'tat-ca';
    const filename = `phieu-diem-danh-${classSlug || 'thang'}-${String(state.month).padStart(2, '0')}-${state.year}.png`;
    canvas.toBlob((blob) => {
        if (!blob) {
            showToast('Không tạo được tệp ảnh PNG', 'danger');
            return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(`Đã tải ảnh ${filename}`, 'success');
    }, 'image/png');
}

function bindEvents() {
    monthSelect?.addEventListener('change', () => {
        state.month = Number(monthSelect.value);
        loadSheet();
    });
    yearSelect?.addEventListener('change', () => {
        state.year = Number(yearSelect.value);
        loadSheet();
    });
    function selectClass(nextValue) {
        state.classId = nextValue || '';
        if (classSelect) {
            classSelect.value = state.classId;
        }
        classTabsHost?.querySelectorAll('[data-sheet-class-tab]').forEach((btn) => {
            const active = btn.dataset.sheetClassTab === state.classId;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        loadSheet();
    }

    classTabsHost?.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-sheet-class-tab]');
        if (!btn) return;
        selectClass(btn.dataset.sheetClassTab);
    });

    classSelect?.addEventListener('change', () => {
        selectClass(classSelect.value);
    });
    teacherInput?.addEventListener('input', () => {
        state.teacher = teacherInput.value;
        renderMeta();
    });
    assistantInput?.addEventListener('input', () => {
        state.assistant = assistantInput.value;
        renderMeta();
    });
    feeInput?.addEventListener('input', () => {
        const parsed = Number(feeInput.value);
        state.feePerDay = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        renderSheet();
    });
    const fitBtn = qs('[data-sheet-fit]');
    const FIT_KEY = 'hk_sheet_fit_screen';

    function applyFitScreen(enabled) {
        document.body.classList.toggle('sheet-fit-screen', enabled);
        if (enabled && window.innerWidth >= 992) {
            document.querySelector('.app-shell')?.classList.add('sidebar-collapsed');
        }
        if (fitBtn) {
            fitBtn.classList.toggle('is-active', enabled);
            fitBtn.setAttribute('aria-pressed', String(enabled));
            fitBtn.innerHTML = enabled
                ? '<i class="bi bi-arrows-angle-expand me-1"></i><span>Đầy đủ</span>'
                : '<i class="bi bi-arrows-angle-contract me-1"></i><span>Xem gọn</span>';
        }
    }

    applyFitScreen(localStorage.getItem(FIT_KEY) === '1');

    fitBtn?.addEventListener('click', () => {
        const next = !document.body.classList.contains('sheet-fit-screen');
        localStorage.setItem(FIT_KEY, next ? '1' : '0');
        applyFitScreen(next);
    });

    qs('[data-sheet-png]')?.addEventListener('click', () => {
        exportPng();
    });
    qs('[data-sheet-print]')?.addEventListener('click', () => {
        window.print();
    });
}

document.addEventListener('hk:ready', async () => {
    const params = new URLSearchParams(window.location.search);
    const initialMonth = Number(params.get('month') || 0);
    const initialYear = Number(params.get('year') || 0);
    if (initialMonth >= 1 && initialMonth <= 12) state.month = initialMonth;
    if (initialYear >= 2000 && initialYear <= 2100) state.year = initialYear;
    const initialClass = (params.get('class_id') || '').trim();
    const hasExplicitClass = params.has('class_id');
    if (initialClass === 'unassigned' || /^\d+$/.test(initialClass)) {
        state.classId = initialClass;
    }

    fillPeriodSelects();
    bindEvents();
    await loadClasses(hasExplicitClass);
    await loadSheet();
});
