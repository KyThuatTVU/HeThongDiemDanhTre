<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\StudentClassHistory;

final class StudentClassHistoryRepository extends Repository
{
    protected string $table = 'student_class_histories';
    protected string $model = StudentClassHistory::class;

    public function openForStudent(int $studentId): ?StudentClassHistory
    {
        $row = $this->fetchOne(
            'SELECT h.*, c.name AS class_name, c.branch_id, b.name AS branch_name
             FROM student_class_histories h
             JOIN classes c ON c.id = h.class_id
             JOIN branches b ON b.id = c.branch_id
             WHERE h.student_id = ? AND h.left_at IS NULL
             ORDER BY h.joined_at DESC, h.id DESC LIMIT 1',
            [$studentId]
        );
        return $row === null ? null : StudentClassHistory::from($row);
    }

    public function create(int $studentId, int $classId, string $joinedAt, ?string $reason, int $userId): int
    {
        return $this->insert([
            'student_id' => $studentId,
            'class_id' => $classId,
            'joined_at' => $joinedAt,
            'reason' => $reason,
            'created_by' => $userId,
        ]);
    }

    public function closeOpenForStudent(int $studentId, string $leftAt, ?string $reason = null): void
    {
        $this->execute(
            'UPDATE student_class_histories
             SET left_at = ?, reason = COALESCE(?, reason)
             WHERE student_id = ? AND left_at IS NULL',
            [$leftAt, $reason, $studentId]
        );
    }
}
