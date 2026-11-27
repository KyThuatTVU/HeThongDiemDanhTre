<?php
declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use App\Infrastructure\Database\Connection;
use App\Repositories\AttendanceRepository;
use App\Repositories\BranchRepository;
use App\Repositories\ClassRepository;
use App\Repositories\StudentRepository;

final class AttendanceService
{
    public const STATUSES = ['present', 'excused_absent', 'unexcused_absent', 'late', 'planned_leave'];

    private AttendanceRepository $attendance;
    private ClassRepository $classes;
    private StudentRepository $students;
    private BranchRepository $branches;
    private AuthorizationService $authz;
    private ActivityLogService $logs;

    public function __construct()
    {
        $this->attendance = new AttendanceRepository();
        $this->classes = new ClassRepository();
        $this->students = new StudentRepository();
        $this->branches = new BranchRepository();
        $this->authz = new AuthorizationService();
        $this->logs = new ActivityLogService();
    }

    /**
     * @param int|string|null $classFilter null = tất cả học viên trong cơ sở, 'unassigned' = chưa xếp lớp, int = theo lớp cụ thể
     */
    public function board(int $branchId, int|string|null $classFilter, string $date, string $slot): array
    {
        $branch = $this->branches->find($branchId);
        if ($branch === null) {
            throw new HttpException(404, 'Không tìm thấy cơ sở');
        }

        $classMeta = [
            'id' => null,
            'name' => $classFilter === 'unassigned' ? 'Chưa xếp lớp' : 'Tất cả học viên',
            'branch_id' => $branchId,
            'branch_name' => $branch->name,
        ];

        if (is_int($classFilter)) {
            $class = $this->classes->findWithBranch($classFilter);
            if ($class === null) {
                throw new HttpException(404, 'Không tìm thấy lớp học');
            }
            if ((int) $class->branch_id !== $branchId) {
                throw new HttpException(422, 'Lớp học không thuộc cơ sở đang chọn');
            }
            $classMeta = [
                'id' => (int) $class->id,
                'name' => $class->name,
                'branch_id' => (int) $class->branch_id,
                'branch_name' => $class->branch_name,
            ];
        }

        $allSessions = $this->attendance->sessionsForBranchDate($branchId, $date, $slot);
        $sessionsByKey = [];
        foreach ($allSessions as $s) {
            $key = $s->class_id === null ? 'unassigned' : (string) $s->class_id;
            $sessionsByKey[$key] = $s;
        }

        $recordsByStudent = [];
        foreach ($this->attendance->recordsForBranchDate($branchId, $date, $slot) as $record) {
            $recordsByStudent[(int) $record->student_id] = $record;
        }

        $students = $this->students->activeForAttendance($branchId, $classFilter);
        $rows = [];
        $summary = ['total' => count($students), 'present' => 0, 'absent' => 0, 'unrecorded' => 0];

        foreach ($students as $student) {
            $studentId = (int) $student['id'];
            $studentClassId = $student['current_class_id'] !== null ? (int) $student['current_class_id'] : null;
            $sessionKey = $studentClassId === null ? 'unassigned' : (string) $studentClassId;
            $targetSession = $sessionsByKey[$sessionKey] ?? null;

            $record = $recordsByStudent[$studentId] ?? null;
            $status = $record !== null ? $record->status : null;
            if ($status === null) {
                $summary['unrecorded']++;
            } elseif (in_array($status, ['present', 'late'], true)) {
                $summary['present']++;
            } else {
                $summary['absent']++;
            }

            $rows[] = [
                'student_id' => $studentId,
                'student_code' => $student['student_code'],
                'full_name' => $student['full_name'],
                'dob' => $student['dob'],
                'class_id' => $studentClassId,
                'class_name' => $student['class_name'],
                'guardian_name' => $student['guardian_name'],
                'guardian_phone' => $student['guardian_phone'],
                'status' => $status,
                'note' => $record?->note,
                'recorded_at' => $record?->recorded_at,
                'is_locked' => $targetSession !== null && (bool) $targetSession->is_locked,
            ];
        }

        $singleSession = null;
        if (is_int($classFilter)) {
            $singleSession = $sessionsByKey[(string) $classFilter] ?? null;
        } elseif ($classFilter === 'unassigned') {
            $singleSession = $sessionsByKey['unassigned'] ?? null;
        }

        $sessionList = array_map(static fn ($s): array => [
            'id' => (int) $s->id,
            'class_id' => $s->class_id !== null ? (int) $s->class_id : null,
            'class_name' => $s->class_name ?? 'Chưa xếp lớp',
            'session_date' => $s->session_date,
            'slot_name' => $s->slot_name,
            'is_locked' => (bool) $s->is_locked,
            'locked_at' => $s->locked_at,
        ], $allSessions);

        $lockedCount = count(array_filter($sessionList, static fn (array $s): bool => $s['is_locked']));
        $totalSessions = count($sessionList);

        $sessionPayload = null;
        if ($classFilter !== null) {
            $sessionPayload = $singleSession === null ? null : [
                'id' => (int) $singleSession->id,
                'session_date' => $singleSession->session_date,
                'slot_name' => $singleSession->slot_name,
                'is_locked' => (bool) $singleSession->is_locked,
                'locked_at' => $singleSession->locked_at,
            ];
        } elseif ($totalSessions > 0) {
            $latestLock = null;
            foreach ($sessionList as $s) {
                if ($s['is_locked'] && ($latestLock === null || ($s['locked_at'] ?? '') > $latestLock)) {
                    $latestLock = $s['locked_at'];
                }
            }
            $sessionPayload = [
                'id' => null,
                'session_date' => $date,
                'slot_name' => $slot,
                'is_locked' => $lockedCount === $totalSessions,
                'partially_locked' => $lockedCount > 0 && $lockedCount < $totalSessions,
                'locked_count' => $lockedCount,
                'total_sessions' => $totalSessions,
                'locked_at' => $latestLock,
            ];
        }

        return [
            'filter' => $classFilter ?? 'all',
            'class' => $classMeta,
            'session' => $sessionPayload,
            'sessions' => $sessionList,
            'students' => $rows,
            'summary' => $summary,
        ];
    }

    /**
     * @param int|string|null $classFilter
     * @param array<int, array<string, mixed>> $records
     * @param array<int, int> $clearedStudentIds
     */
    public function save(
        int $branchId,
        int|string|null $classFilter,
        string $date,
        string $slot,
        array $records,
        int $actorId,
        array $clearedStudentIds = []
    ): array {
        if (is_int($classFilter)) {
            $class = $this->classes->findWithBranch($classFilter);
            if ($class === null) {
                throw new HttpException(404, 'Không tìm thấy lớp học');
            }
            if ((int) $class->branch_id !== $branchId) {
                throw new HttpException(422, 'Lớp học không thuộc cơ sở đang chọn');
            }
        }

        if ($records === [] && $clearedStudentIds === []) {
            throw new HttpException(422, 'Danh sách điểm danh không được để trống');
        }

        $eligibleRows = $this->students->activeForAttendance($branchId, $classFilter);
        $eligibleById = [];
        foreach ($eligibleRows as $student) {
            $eligibleById[(int) $student['id']] = $student;
        }

        $grouped = []; // classKey ('unassigned' or class_id string) => ['class_id' => ?int, 'items' => [studentId => [...]]]
        foreach ($records as $index => $record) {
            $studentId = (int) ($record['student_id'] ?? 0);
            $status = (string) ($record['status'] ?? '');
            if (!isset($eligibleById[$studentId])) {
                throw new HttpException(422, 'Học viên không thuộc phạm vi điểm danh hoặc đã ngừng học (dòng ' . ($index + 1) . ')');
            }
            if (!in_array($status, self::STATUSES, true)) {
                throw new HttpException(422, 'Trạng thái điểm danh không hợp lệ (dòng ' . ($index + 1) . ')');
            }
            $note = isset($record['note']) && $record['note'] !== '' ? mb_substr(trim((string) $record['note']), 0, 255) : null;
            $studentClassId = $eligibleById[$studentId]['current_class_id'] !== null
                ? (int) $eligibleById[$studentId]['current_class_id']
                : null;
            $groupKey = $studentClassId === null ? 'unassigned' : (string) $studentClassId;
            if (!isset($grouped[$groupKey])) {
                $grouped[$groupKey] = ['class_id' => $studentClassId, 'items' => []];
            }
            $grouped[$groupKey]['items'][$studentId] = ['status' => $status, 'note' => $note];
        }

        $cleanCleared = [];
        foreach ($clearedStudentIds as $sid) {
            $sid = (int) $sid;
            if ($sid > 0 && isset($eligibleById[$sid])) {
                $cleanCleared[$sid] = $eligibleById[$sid];
            }
        }

        $existingSessions = [];
        foreach ($this->attendance->sessionsForBranchDate($branchId, $date, $slot) as $s) {
            $key = $s->class_id === null ? 'unassigned' : (string) $s->class_id;
            $existingSessions[$key] = $s;
        }

        $canEditLocked = $this->authz->can('attendance.edit');
        foreach ($grouped as $groupKey => $group) {
            $existing = $existingSessions[$groupKey] ?? null;
            if ($existing !== null && (int) $existing->is_locked === 1 && !$canEditLocked) {
                throw new HttpException(403, 'Sổ điểm danh đã khoá, bạn không có quyền chỉnh sửa');
            }
        }
        foreach ($cleanCleared as $student) {
            $cid = $student['current_class_id'] !== null ? (int) $student['current_class_id'] : null;
            $gKey = $cid === null ? 'unassigned' : (string) $cid;
            $existing = $existingSessions[$gKey] ?? null;
            if ($existing !== null && (int) $existing->is_locked === 1 && !$canEditLocked) {
                throw new HttpException(403, 'Sổ điểm danh đã khoá, bạn không có quyền chỉnh sửa');
            }
        }

        $existingRecordsByStudent = [];
        foreach ($this->attendance->recordsForBranchDate($branchId, $date, $slot) as $rec) {
            $existingRecordsByStudent[(int) $rec->student_id] = $rec;
        }

        $sessionIds = [];
        $savedCount = 0;

        Connection::transaction(function () use (
            &$sessionIds,
            &$savedCount,
            $branchId,
            $date,
            $slot,
            $grouped,
            $cleanCleared,
            $existingSessions,
            $existingRecordsByStudent,
            $actorId
        ): void {
            foreach ($grouped as $groupKey => $group) {
                $existing = $existingSessions[$groupKey] ?? null;
                $sessionId = $existing !== null
                    ? (int) $existing->id
                    : $this->attendance->createSession($branchId, $group['class_id'], $date, $slot, $actorId);
                $sessionIds[] = $sessionId;

                foreach ($group['items'] as $studentId => $item) {
                    $prev = $existingRecordsByStudent[$studentId] ?? null;
                    if ($prev !== null && (int) $prev->attendance_session_id !== $sessionId) {
                        $this->attendance->deleteForStudentOnDate($branchId, $studentId, $date, $slot);
                    }
                    $this->attendance->upsert($sessionId, $studentId, $item['status'], $item['note'], $actorId);
                    $savedCount++;
                }
            }

            foreach (array_keys($cleanCleared) as $studentId) {
                $this->attendance->deleteForStudentOnDate($branchId, $studentId, $date, $slot);
            }
        });

        $label = 'toàn cơ sở';
        if (is_int($classFilter)) {
            $c = $this->classes->findWithBranch($classFilter);
            $label = 'lớp ' . ($c?->name ?? ('#' . $classFilter));
        } elseif ($classFilter === 'unassigned') {
            $label = 'nhóm chưa xếp lớp';
        }

        $this->logs->record(
            'save',
            'attendance',
            'attendance_session',
            $sessionIds[0] ?? null,
            'Điểm danh ' . $label . ' ngày ' . $date . ' (' . $savedCount . ' học viên)'
        );

        return [
            'session_id' => $sessionIds[0] ?? null,
            'session_ids' => $sessionIds,
            'saved' => $savedCount,
            'cleared' => count($cleanCleared),
            'is_locked' => false,
        ];
    }

    public function lock(int $sessionId, int $actorId): void
    {
        $session = $this->attendance->sessionById($sessionId);
        if ($session === null) {
            throw new HttpException(404, 'Không tìm thấy phiên điểm danh');
        }
        $this->authz->assertBranch((int) $session->branch_id);
        if ((int) $session->is_locked === 1) {
            throw new HttpException(422, 'Phiên điểm danh đã được khoá');
        }
        $this->attendance->setLock($sessionId, true, $actorId);
        $this->logs->record('lock', 'attendance', 'attendance_session', $sessionId, 'Khoá sổ điểm danh ngày ' . $session->session_date);
    }

    public function unlock(int $sessionId, int $actorId): void
    {
        $session = $this->attendance->sessionById($sessionId);
        if ($session === null) {
            throw new HttpException(404, 'Không tìm thấy phiên điểm danh');
        }
        $this->authz->assertBranch((int) $session->branch_id);
        if ((int) $session->is_locked !== 1) {
            throw new HttpException(422, 'Phiên điểm danh chưa được khoá');
        }
        $this->attendance->setLock($sessionId, false, $actorId);
        $this->logs->record('unlock', 'attendance', 'attendance_session', $sessionId, 'Mở khoá sổ điểm danh ngày ' . $session->session_date);
    }

    public function setDayLock(int $branchId, string $date, string $slot, bool $locked, int $actorId): int
    {
        $this->authz->assertBranch($branchId);
        $sessions = $this->attendance->sessionsForBranchDate($branchId, $date, $slot);
        if ($sessions === []) {
            throw new HttpException(422, 'Chưa có sổ điểm danh nào được lưu cho ngày ' . $date);
        }
        $affected = $this->attendance->setLockForBranchDate($branchId, $date, $slot, $locked, $actorId);
        $this->logs->record(
            $locked ? 'lock' : 'unlock',
            'attendance',
            'branch',
            $branchId,
            ($locked ? 'Khoá' : 'Mở khoá') . ' toàn bộ sổ điểm danh ngày ' . $date . ' (ca ' . $slot . ')'
        );
        return $affected;
    }

    public function history(array $filters, int $page, int $perPage): array
    {
        return $this->attendance->history($filters, $page, $perPage);
    }

    /**
     * Phiếu điểm danh tổng hợp theo tháng (dạng ma trận ngày 1..31)
     *
     * @param int|string|null $classFilter null = tất cả học viên, 'unassigned' = chưa xếp lớp, int = theo lớp
     */
    public function monthlySheet(int $branchId, int $year, int $month, int|string|null $classFilter = null): array
    {
        $branch = $this->branches->find($branchId);
        if ($branch === null) {
            throw new HttpException(404, 'Không tìm thấy cơ sở');
        }

        $classLabel = $classFilter === 'unassigned' ? 'Chưa xếp lớp' : 'Tất cả học viên';
        if (is_int($classFilter)) {
            $class = $this->classes->findWithBranch($classFilter);
            if ($class === null) {
                throw new HttpException(404, 'Không tìm thấy lớp học');
            }
            if ((int) $class->branch_id !== $branchId) {
                throw new HttpException(422, 'Lớp học không thuộc cơ sở đang chọn');
            }
            $classLabel = (string) $class->name;
        }

        $daysInMonth = (int) cal_days_in_month(CAL_GREGORIAN, $month, $year);
        $dateFrom = sprintf('%04d-%02d-01', $year, $month);
        $dateTo = sprintf('%04d-%02d-%02d', $year, $month, $daysInMonth);

        $sundays = [];
        for ($d = 1; $d <= $daysInMonth; $d++) {
            $ts = mktime(0, 0, 0, $month, $d, $year);
            if ($ts !== false && (int) date('w', $ts) === 0) {
                $sundays[] = $d;
            }
        }

        $students = $this->students->activeForAttendance($branchId, $classFilter);
        $records = $this->attendance->monthlyRecordsForBranch($branchId, $dateFrom, $dateTo);
        $tuitionByStudent = $this->attendance->monthlyTuitionByBranch($branchId, $year, $month);

        $daysByStudent = [];
        $notesByStudent = [];
        foreach ($records as $rec) {
            $sid = (int) $rec['student_id'];
            $day = (int) substr((string) $rec['session_date'], 8, 2);
            if ($day < 1 || $day > $daysInMonth) {
                continue;
            }
            $daysByStudent[$sid][$day] = (string) $rec['status'];
            if (!empty($rec['note'])) {
                $notesByStudent[$sid][$day] = (string) $rec['note'];
            }
        }

        $rows = [];
        $totals = ['present' => 0, 'late' => 0, 'excused_absent' => 0, 'unexcused_absent' => 0, 'planned_leave' => 0];
        foreach ($students as $student) {
            $sid = (int) $student['id'];
            $studentDays = $daysByStudent[$sid] ?? [];
            $studentNotes = $notesByStudent[$sid] ?? [];

            $presentDays = 0;
            $lateDays = 0;
            $excusedDays = 0;
            $unexcusedDays = 0;
            $plannedDays = 0;

            foreach ($studentDays as $st) {
                match ($st) {
                    'present' => $presentDays++,
                    'late' => $lateDays++,
                    'excused_absent' => $excusedDays++,
                    'unexcused_absent' => $unexcusedDays++,
                    'planned_leave' => $plannedDays++,
                    default => null,
                };
            }

            $totals['present'] += $presentDays;
            $totals['late'] += $lateDays;
            $totals['excused_absent'] += $excusedDays;
            $totals['unexcused_absent'] += $unexcusedDays;
            $totals['planned_leave'] += $plannedDays;

            $tuition = $tuitionByStudent[$sid] ?? null;
            $monthlyFee = (float) ($student['monthly_fee'] ?? 0);

            $rows[] = [
                'student_id' => $sid,
                'student_code' => $student['student_code'],
                'full_name' => $student['full_name'],
                'class_id' => $student['current_class_id'] !== null ? (int) $student['current_class_id'] : null,
                'class_name' => $student['class_name'],
                'guardian_phone' => $student['guardian_phone'],
                'monthly_fee' => $monthlyFee,
                'tuition_final_amount' => $tuition !== null ? (float) $tuition['final_amount'] : ($monthlyFee > 0 ? $monthlyFee : null),
                'days' => (object) $studentDays,
                'notes' => (object) $studentNotes,
                'present_days' => $presentDays + $lateDays,
                'present_only_days' => $presentDays,
                'late_days' => $lateDays,
                'excused_days' => $excusedDays,
                'unexcused_days' => $unexcusedDays,
                'planned_leave_days' => $plannedDays,
            ];
        }

        return [
            'branch' => [
                'id' => $branchId,
                'name' => $branch->name,
            ],
            'year' => $year,
            'month' => $month,
            'days_in_month' => $daysInMonth,
            'sundays' => $sundays,
            'filter' => $classFilter ?? 'all',
            'class_label' => $classLabel,
            'students' => $rows,
            'summary' => [
                'total_students' => count($rows),
                'present_total' => $totals['present'] + $totals['late'],
                'absent_total' => $totals['excused_absent'] + $totals['unexcused_absent'] + $totals['planned_leave'],
                'by_status' => $totals,
            ],
        ];
    }
}
