<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\Model;
use App\Models\SchoolClass;

final class ClassRepository extends Repository
{
    protected string $table = 'classes';
    protected string $model = SchoolClass::class;

    private const SELECT = 'SELECT c.*, b.name AS branch_name,
        (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id AND s.deleted_at IS NULL AND s.status = "active") AS student_count
        FROM classes c JOIN branches b ON b.id = c.branch_id';

    public function listByBranch(?int $branchId, bool $includeInactive = true, bool $onlyInactive = false): array
    {
        $where = [];
        $params = [];
        if ($branchId !== null) {
            $where[] = 'c.branch_id = ?';
            $params[] = $branchId;
        }
        if ($onlyInactive) {
            $where[] = "c.status = 'inactive'";
        } elseif (!$includeInactive) {
            $where[] = "c.status = 'active'";
        }
        $sql = self::SELECT . ($where === [] ? '' : ' WHERE ' . implode(' AND ', $where)) . ' ORDER BY c.status, c.name';
        return array_map(
            static fn (array $row): SchoolClass => SchoolClass::from($row),
            $this->fetchAll($sql, $params)
        );
    }

    public function findWithBranch(int $id): ?SchoolClass
    {
        $row = $this->fetchOne(self::SELECT . ' WHERE c.id = ? LIMIT 1', [$id]);
        return $row === null ? null : SchoolClass::from($row);
    }

    public function find(int $id): ?Model
    {
        return $this->findWithBranch($id);
    }

    public function nameExists(int $branchId, string $name, ?int $exceptId = null): bool
    {
        $sql = 'SELECT COUNT(*) FROM classes WHERE branch_id = ? AND name = ?';
        $params = [$branchId, $name];
        if ($exceptId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $exceptId;
        }
        return (int) $this->fetchValue($sql, $params) > 0;
    }

    public function create(array $data): int
    {
        return $this->insert($data);
    }

    public function update(int $id, array $data): int
    {
        return $this->updateById($id, $data);
    }

    public function students(int $classId): array
    {
        return $this->fetchAll(
            "SELECT s.id, s.student_code, s.full_name, s.dob, s.gender, s.status, s.guardian_name, s.guardian_phone
             FROM students s
             WHERE s.current_class_id = ? AND s.deleted_at IS NULL
             ORDER BY s.full_name",
            [$classId]
        );
    }

    public function activeForBranch(int $branchId): array
    {
        return $this->fetchAll(
            "SELECT id, name FROM classes WHERE branch_id = ? AND status = 'active' ORDER BY name",
            [$branchId]
        );
    }

    public function belongsToBranch(int $classId, int $branchId): bool
    {
        return (int) $this->fetchValue(
            'SELECT COUNT(*) FROM classes WHERE id = ? AND branch_id = ?',
            [$classId, $branchId]
        ) > 0;
    }

    public function historyForClass(int $classId, int $limit = 50): array
    {
        return $this->fetchAll(
            'SELECT h.*, s.student_code, s.full_name
             FROM student_class_histories h
             JOIN students s ON s.id = h.student_id
             WHERE h.class_id = ?
             ORDER BY h.joined_at DESC, h.id DESC
             LIMIT ' . max(1, $limit),
            [$classId]
        );
    }
}
