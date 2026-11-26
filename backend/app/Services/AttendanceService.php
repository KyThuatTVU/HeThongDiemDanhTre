<?php
declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use App\Infrastructure\Database\Connection;
use App\Repositories\AttendanceRepository;
use App\Repositories\ClassRepository;

final class AttendanceService
{
    public const STATUSES = ['present', 'excused_absent', 'unexcused_absent', 'late', 'planned_leave'];

    private AttendanceRepository $attendance;
    private ClassRepository $classes;
    private AuthorizationService $authz;
    private ActivityLogService $logs;

    public function __construct()
    {
        $this->attendance = new AttendanceRepository();
        $this->classes = new ClassRepository();
        $this->authz = new AuthorizationService();
        $this->logs = new ActivityLogService();
    }

    public function board(int $branchId, int $classId, string $date, string $slot): array
    {
        $class = $this->classes->findWithBranch($classId);
        if ($class === null) {
            throw new HttpException(404, 'Không tìm thấy lớp học');
        }
        if ((int) $class->branch_id !== $branchId) {
            throw new HttpException(422, 'Lớp học không thuộc cơ sở đang chọn');
        }

        $session = $this->attendance->findSession($classId, $date, $slot);
        $recordsByStudent = [];
        if ($session !== null) {
            foreach ($this->attendance->recordsForSession((int) $session->id) as $record) {
                $recordsByStudent[(int) $record->student_id] = $record;
            }
        }

        $students = array_values(array_filter(
            $this->classes->students($classId),
            static fn (array $student): bool => ($student['status'] ?? '') === 'active'
        ));

        $rows = [];
        $summary = ['present' => 0, 'absent' => 0, 'unrecorded' => 0];
        foreach ($students as $student) {
            $record = $recordsByStudent[(int) $student['id']] ?? null;
            $status = $record !== null ? $record->status : null;
            if ($status === null) {
                $summary['unrecorded']++;
            } elseif (in_array($status, ['present', 'late'], true)) {
                $summary['present']++;
            } else {
                $summary['absent']++;
            }
            $rows[] = [
                'student_id' => (int) $student['id'],
                'student_code' => $student['student_code'],
                'full_name' => $student['full_name'],
                'dob' => $student['dob'],
                'guardian_name' => $student['guardian_name'],
                'guardian_phone' => $student['guardian_phone'],
                'status' => $status,
                'note' => $record?->note,
                'recorded_at' => $record?->recorded_at,
            ];
        }

        return [
            'class' => [
                'id' => (int) $class->id,
                'name' => $class->name,
                'branch_id' => (int) $class->branch_id,
                'branch_name' => $class->branch_name,
            ],
            'session' => $session === null ? null : [
                'id' => (int) $session->id,
                'session_date' => $session->session_date,
                'slot_name' => $session->slot_name,
                'is_locked' => (bool) $session->is_locked,
                'locked_at' => $session->locked_at,
            ],
            'students' => $rows,
            'summary' => $summary,
        ];
    }

    public function save(int $branchId, int $classId, string $date, string $slot, array $records, int $actorId): array
    {
        $class = $this->classes->findWithBranch($classId);
        if ($class === null) {
            throw new HttpException(404, 'Không tìm thấy lớp học');
        }
        if ((int) $class->branch_id !== $branchId) {
            throw new HttpException(422, 'Lớp học không thuộc cơ sở đang chọn');
        }
        if ($records === []) {
            throw new HttpException(422, 'Danh sách điểm danh không được để trống');
        }

        $session = $this->attendance->findSession($classId, $date, $slot);
        if ($session !== null && (int) $session->is_locked === 1 && !$this->authz->can('attendance.edit')) {
            throw new HttpException(403, 'Sổ điểm danh đã khoá, bạn không có quyền chỉnh sửa');
        }

        $classStudentIds = array_map(
            static fn (array $student): int => (int) $student['id'],
            array_values(array_filter(
                $this->classes->students($classId),
                static fn (array $student): bool => ($student['status'] ?? '') === 'active'
            ))
        );

        $normalized = [];
        foreach ($records as $index => $record) {
            $studentId = (int) ($record['student_id'] ?? 0);
            $status = (string) ($record['status'] ?? '');
            if (!in_array($studentId, $classStudentIds, true)) {
                throw new HttpException(422, 'Học viên không thuộc lớp hoặc đã ngừng học (dòng ' . ($index + 1) . ')');
            }
            if (!in_array($status, self::STATUSES, true)) {
                throw new HttpException(422, 'Trạng thái điểm danh không hợp lệ (dòng ' . ($index + 1) . ')');
            }
            $note = isset($record['note']) && $record['note'] !== '' ? mb_substr((string) $record['note'], 0, 255) : null;
            $normalized[$studentId] = ['status' => $status, 'note' => $note];
        }

        $sessionId = $session !== null ? (int) $session->id : 0;
        Connection::transaction(function () use (&$sessionId, $branchId, $classId, $date, $slot, $normalized, $actorId): void {
            if ($sessionId === 0) {
                $sessionId = $this->attendance->createSession($branchId, $classId, $date, $slot, $actorId);
            }
            foreach ($normalized as $studentId => $record) {
                $this->attendance->upsert($sessionId, $studentId, $record['status'], $record['note'], $actorId);
            }
        });

        $this->logs->record(
            'save',
            'attendance',
            'attendance_session',
            $sessionId,
            'Điểm danh lớp ' . $class->name . ' ngày ' . $date . ' (' . count($normalized) . ' học viên)'
        );

        return [
            'session_id' => $sessionId,
            'saved' => count($normalized),
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

    public function history(array $filters, int $page, int $perPage): array
    {
        return $this->attendance->history($filters, $page, $perPage);
    }
}
