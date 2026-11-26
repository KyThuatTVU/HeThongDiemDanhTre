<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\Attendance;
use App\Models\AttendanceSession;

final class AttendanceRepository extends Repository
{
    protected string $table = 'attendance';

    public function findSession(int $classId, string $sessionDate, string $slotName): ?AttendanceSession
    {
        $row = $this->fetchOne(
            'SELECT s.*, c.name AS class_name, b.name AS branch_name
             FROM attendance_sessions s
             JOIN classes c ON c.id = s.class_id
             JOIN branches b ON b.id = s.branch_id
             WHERE s.class_id = ? AND s.session_date = ? AND s.slot_name = ? LIMIT 1',
            [$classId, $sessionDate, $slotName]
        );
        return $row === null ? null : AttendanceSession::from($row);
    }

    public function sessionById(int $id): ?AttendanceSession
    {
        $row = $this->fetchOne(
            'SELECT s.*, c.name AS class_name, b.name AS branch_name
             FROM attendance_sessions s
             JOIN classes c ON c.id = s.class_id
             JOIN branches b ON b.id = s.branch_id
             WHERE s.id = ? LIMIT 1',
            [$id]
        );
        return $row === null ? null : AttendanceSession::from($row);
    }

    public function createSession(int $branchId, int $classId, string $sessionDate, string $slotName, int $userId): int
    {
        return $this->insert([
            'branch_id' => $branchId,
            'class_id' => $classId,
            'session_date' => $sessionDate,
            'slot_name' => $slotName,
            'created_by' => $userId,
        ]);
    }

    public function recordsForSession(int $sessionId): array
    {
        $rows = $this->fetchAll(
            'SELECT a.*, s.student_code, s.full_name
             FROM attendance a
             JOIN students s ON s.id = a.student_id
             WHERE a.attendance_session_id = ?',
            [$sessionId]
        );
        return array_map(static fn (array $row): Attendance => Attendance::from($row), $rows);
    }

    public function upsert(int $sessionId, int $studentId, string $status, ?string $note, int $userId): void
    {
        $this->execute(
            'INSERT INTO attendance (attendance_session_id, student_id, status, note, recorded_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note),
                updated_by = VALUES(recorded_by), updated_at = NOW()',
            [$sessionId, $studentId, $status, $note, $userId]
        );
    }

    public function setLock(int $sessionId, bool $locked, int $userId): void
    {
        $this->execute(
            'UPDATE attendance_sessions
             SET is_locked = ?, locked_at = ' . ($locked ? 'NOW()' : 'NULL') . ', locked_by = ?
             WHERE id = ?',
            [$locked ? 1 : 0, $userId, $sessionId]
        );
    }

    public function history(array $filters, int $page, int $perPage): array
    {
        $where = ['s.branch_id = ?'];
        $params = [(int) $filters['branch_id']];
        if (!empty($filters['class_id'])) {
            $where[] = 's.class_id = ?';
            $params[] = (int) $filters['class_id'];
        }
        if (!empty($filters['student_id'])) {
            $where[] = 'a.student_id = ?';
            $params[] = (int) $filters['student_id'];
        }
        if (!empty($filters['date_from'])) {
            $where[] = 's.session_date >= ?';
            $params[] = $filters['date_from'];
        }
        if (!empty($filters['date_to'])) {
            $where[] = 's.session_date <= ?';
            $params[] = $filters['date_to'];
        }
        $whereSql = ' WHERE ' . implode(' AND ', $where);

        $total = (int) $this->fetchValue(
            'SELECT COUNT(*) FROM attendance a
             JOIN attendance_sessions s ON s.id = a.attendance_session_id' . $whereSql,
            $params
        );
        $offset = ($page - 1) * $perPage;
        $rows = $this->fetchAll(
            'SELECT a.id, a.status, a.note, a.recorded_at, a.updated_at,
                    s.id AS session_id, s.session_date, s.slot_name, s.is_locked,
                    c.name AS class_name, st.student_code, st.full_name,
                    u.full_name AS recorded_by_name
             FROM attendance a
             JOIN attendance_sessions s ON s.id = a.attendance_session_id
             JOIN classes c ON c.id = s.class_id
             JOIN students st ON st.id = a.student_id
             LEFT JOIN users u ON u.id = a.recorded_by'
             . $whereSql .
            ' ORDER BY s.session_date DESC, c.name, st.full_name LIMIT ' . $perPage . ' OFFSET ' . $offset,
            $params
        );
        return ['items' => $rows, 'total' => $total];
    }

    public function dayCounts(int $branchId, string $date): array
    {
        $row = $this->fetchOne(
            "SELECT
                SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS present_count,
                SUM(CASE WHEN a.status IN ('excused_absent','unexcused_absent','planned_leave') THEN 1 ELSE 0 END) AS absent_count,
                COUNT(*) AS recorded_count
             FROM attendance a
             JOIN attendance_sessions s ON s.id = a.attendance_session_id
             WHERE s.branch_id = ? AND s.session_date = ?",
            [$branchId, $date]
        );
        return [
            'present' => (int) ($row['present_count'] ?? 0),
            'absent' => (int) ($row['absent_count'] ?? 0),
            'recorded' => (int) ($row['recorded_count'] ?? 0),
        ];
    }

    public function statusCountsForStudent(int $studentId, string $dateFrom, string $dateTo): array
    {
        $rows = $this->fetchAll(
            'SELECT a.status, COUNT(*) AS total
             FROM attendance a
             JOIN attendance_sessions s ON s.id = a.attendance_session_id
             WHERE a.student_id = ? AND s.session_date BETWEEN ? AND ?
             GROUP BY a.status',
            [$studentId, $dateFrom, $dateTo]
        );
        $counts = [
            'present' => 0,
            'excused_absent' => 0,
            'unexcused_absent' => 0,
            'late' => 0,
            'planned_leave' => 0,
        ];
        foreach ($rows as $row) {
            $counts[(string) $row['status']] = (int) $row['total'];
        }
        $counts['present_total'] = $counts['present'] + $counts['late'];
        $counts['absent_total'] = $counts['excused_absent'] + $counts['unexcused_absent'] + $counts['planned_leave'];
        return $counts;
    }

    public function dailySeries(?int $branchId, int $days = 7): array
    {
        $from = date('Y-m-d', strtotime('-' . max(0, $days - 1) . ' days'));
        $to = date('Y-m-d');
        $where = ['s.session_date BETWEEN ? AND ?'];
        $params = [$from, $to];
        if ($branchId !== null) {
            $where[] = 's.branch_id = ?';
            $params[] = $branchId;
        }
        $rows = $this->fetchAll(
            "SELECT s.session_date,
                    SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS present_count,
                    SUM(CASE WHEN a.status IN ('excused_absent','unexcused_absent','planned_leave') THEN 1 ELSE 0 END) AS absent_count
             FROM attendance a
             JOIN attendance_sessions s ON s.id = a.attendance_session_id
             WHERE " . implode(' AND ', $where) . '
             GROUP BY s.session_date ORDER BY s.session_date',
            $params
        );
        $byDate = [];
        foreach ($rows as $row) {
            $byDate[(string) $row['session_date']] = [
                'present' => (int) $row['present_count'],
                'absent' => (int) $row['absent_count'],
            ];
        }
        $series = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = date('Y-m-d', strtotime('-' . $i . ' days'));
            $series[] = [
                'date' => $date,
                'present' => $byDate[$date]['present'] ?? 0,
                'absent' => $byDate[$date]['absent'] ?? 0,
            ];
        }
        return $series;
    }

    public function monthSummaryByClass(int $branchId, string $dateFrom, string $dateTo, ?int $classId = null): array
    {
        $where = ['s.branch_id = ?', 's.session_date BETWEEN ? AND ?'];
        $params = [$branchId, $dateFrom, $dateTo];
        if ($classId !== null) {
            $where[] = 'st.current_class_id = ?';
            $params[] = $classId;
        }
        $rows = $this->fetchAll(
            "SELECT st.id AS student_id, st.student_code, st.full_name, c.name AS class_name,
                    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
                    SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late,
                    SUM(CASE WHEN a.status = 'excused_absent' THEN 1 ELSE 0 END) AS excused_absent,
                    SUM(CASE WHEN a.status = 'unexcused_absent' THEN 1 ELSE 0 END) AS unexcused_absent,
                    SUM(CASE WHEN a.status = 'planned_leave' THEN 1 ELSE 0 END) AS planned_leave,
                    COUNT(*) AS total
             FROM attendance a
             JOIN attendance_sessions s ON s.id = a.attendance_session_id
             JOIN students st ON st.id = a.student_id
             LEFT JOIN classes c ON c.id = st.current_class_id
             WHERE " . implode(' AND ', $where) . '
             GROUP BY st.id, st.student_code, st.full_name, c.name
             ORDER BY st.full_name',
            $params
        );
        foreach ($rows as &$row) {
            foreach (['present', 'late', 'excused_absent', 'unexcused_absent', 'planned_leave', 'total'] as $key) {
                $row[$key] = (int) $row[$key];
            }
            $presentTotal = $row['present'] + $row['late'];
            $row['present_total'] = $presentTotal;
            $row['absent_total'] = $row['total'] - $presentTotal;
            $row['attendance_rate'] = $row['total'] > 0 ? round($presentTotal * 100 / $row['total'], 1) : null;
        }
        unset($row);
        return $rows;
    }
}
