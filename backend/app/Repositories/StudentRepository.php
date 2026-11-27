<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\Model;
use App\Models\Student;

final class StudentRepository extends Repository
{
    protected string $table = 'students';
    protected string $model = Student::class;

    private const SELECT = 'SELECT s.*, b.name AS branch_name, c.name AS class_name
        FROM students s
        JOIN branches b ON b.id = s.branch_id
        LEFT JOIN classes c ON c.id = s.current_class_id';

    private function buildWhere(array $filters): array
    {
        $where = [];
        $params = [];

        if (empty($filters['include_deleted'])) {
            $where[] = 's.deleted_at IS NULL';
        } elseif (($filters['include_deleted'] ?? '') === 'only') {
            $where[] = 's.deleted_at IS NOT NULL';
        }
        if (!empty($filters['branch_id'])) {
            $where[] = 's.branch_id = ?';
            $params[] = (int) $filters['branch_id'];
        }
        if (!empty($filters['status'])) {
            $where[] = 's.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['class_id'])) {
            $where[] = 's.current_class_id = ?';
            $params[] = (int) $filters['class_id'];
        }
        if (!empty($filters['q'])) {
            $where[] = '(s.student_code LIKE ? OR s.full_name LIKE ? OR s.guardian_name LIKE ? OR s.guardian_phone LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            array_push($params, $like, $like, $like, $like);
        }
        return [$where === [] ? '' : ' WHERE ' . implode(' AND ', $where), $params];
    }

    public function paginate(array $filters, int $page, int $perPage): array
    {
        [$whereSql, $params] = $this->buildWhere($filters);
        $total = (int) $this->fetchValue(
            'SELECT COUNT(*) FROM students s JOIN branches b ON b.id = s.branch_id LEFT JOIN classes c ON c.id = s.current_class_id' . $whereSql,
            $params
        );
        $offset = ($page - 1) * $perPage;
        $rows = $this->fetchAll(
            self::SELECT . $whereSql . ' ORDER BY s.id DESC LIMIT ' . $perPage . ' OFFSET ' . $offset,
            $params
        );
        return [
            'items' => array_map(static fn (array $row): Student => Student::from($row), $rows),
            'total' => $total,
        ];
    }

    public function allForReport(array $filters): array
    {
        [$whereSql, $params] = $this->buildWhere($filters);
        return $this->fetchAll(self::SELECT . $whereSql . ' ORDER BY s.branch_id, s.full_name', $params);
    }

    public function findDetail(int $id): ?Student
    {
        $row = $this->fetchOne(self::SELECT . ' WHERE s.id = ? LIMIT 1', [$id]);
        return $row === null ? null : Student::from($row);
    }

    public function findByAvatarPath(string $path): ?array
    {
        return $this->fetchOne(
            'SELECT id, branch_id FROM students WHERE avatar_path = ? LIMIT 1',
            [$path]
        );
    }

    public function find(int $id): ?Model
    {
        return $this->findDetail($id);
    }

    public function findByCode(string $code, ?int $exceptId = null): ?array
    {
        $sql = 'SELECT * FROM students WHERE student_code = ?';
        $params = [$code];
        if ($exceptId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $exceptId;
        }
        return $this->fetchOne($sql . ' LIMIT 1', $params);
    }

    public function findByIdentityCode(string $identityCode, ?int $exceptId = null): ?array
    {
        $sql = 'SELECT * FROM students WHERE identity_code = ?';
        $params = [$identityCode];
        if ($exceptId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $exceptId;
        }
        return $this->fetchOne($sql . ' LIMIT 1', $params);
    }

    public function create(array $data): int
    {
        return $this->insert($data);
    }

    public function update(int $id, array $data): int
    {
        return $this->updateById($id, $data);
    }

    public function softDelete(int $id, int $userId): void
    {
        $this->updateById($id, ['deleted_at' => now(), 'deleted_by' => $userId]);
    }

    public function restore(int $id): void
    {
        $this->updateById($id, ['deleted_at' => null, 'deleted_by' => null]);
    }

    public function countsByStatus(?int $branchId = null): array
    {
        $sql = 'SELECT status, COUNT(*) AS total FROM students WHERE deleted_at IS NULL';
        $params = [];
        if ($branchId !== null) {
            $sql .= ' AND branch_id = ?';
            $params[] = $branchId;
        }
        $sql .= ' GROUP BY status';
        $counts = ['total' => 0, 'active' => 0, 'paused' => 0, 'left' => 0];
        foreach ($this->fetchAll($sql, $params) as $row) {
            $status = (string) $row['status'];
            $counts[$status] = (int) $row['total'];
            $counts['total'] += (int) $row['total'];
        }
        return $counts;
    }

    public function activeForTuition(int $branchId): array
    {
        return $this->fetchAll(
            "SELECT id, student_code, full_name, monthly_fee FROM students
             WHERE branch_id = ? AND status = 'active' AND deleted_at IS NULL ORDER BY full_name",
            [$branchId]
        );
    }

    public function activeForAttendance(int $branchId, int|string|null $classFilter = null): array
    {
        $where = ['s.branch_id = ?', "s.status = 'active'", 's.deleted_at IS NULL'];
        $params = [$branchId];
        if ($classFilter === 'unassigned') {
            $where[] = 's.current_class_id IS NULL';
        } elseif (is_int($classFilter) && $classFilter > 0) {
            $where[] = 's.current_class_id = ?';
            $params[] = $classFilter;
        }
        return $this->fetchAll(
            'SELECT s.id, s.student_code, s.full_name, s.dob, s.gender, s.status,
                    s.guardian_name, s.guardian_phone, s.monthly_fee, s.current_class_id,
                    c.name AS class_name
             FROM students s
             LEFT JOIN classes c ON c.id = s.current_class_id
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY (s.current_class_id IS NULL) ASC, c.name ASC, s.student_code ASC, s.full_name ASC',
            $params
        );
    }

    public function autocomplete(int $branchId, string $keyword, int $limit = 10): array
    {
        $like = '%' . $keyword . '%';
        return $this->fetchAll(
            "SELECT id, student_code, full_name FROM students
             WHERE branch_id = ? AND deleted_at IS NULL
               AND (student_code LIKE ? OR full_name LIKE ? OR guardian_phone LIKE ?)
             ORDER BY full_name LIMIT " . $limit,
            [$branchId, $like, $like, $like]
        );
    }

    public function newEnrollmentsByMonth(?int $branchId, int $year): array
    {
        $sql = "SELECT MONTH(enrollment_date) AS period, COUNT(*) AS total FROM students
                WHERE deleted_at IS NULL AND YEAR(enrollment_date) = ?";
        $params = [$year];
        if ($branchId !== null) {
            $sql .= ' AND branch_id = ?';
            $params[] = $branchId;
        }
        $sql .= ' GROUP BY MONTH(enrollment_date)';
        $rows = $this->fetchAll($sql, $params);
        return array_column($rows, 'total', 'period');
    }

    public function leftByMonth(?int $branchId, int $year): array
    {
        $sql = "SELECT MONTH(left_at) AS period, COUNT(*) AS total FROM students
                WHERE deleted_at IS NULL AND left_at IS NOT NULL AND YEAR(left_at) = ?";
        $params = [$year];
        if ($branchId !== null) {
            $sql .= ' AND branch_id = ?';
            $params[] = $branchId;
        }
        $sql .= ' GROUP BY MONTH(left_at)';
        $rows = $this->fetchAll($sql, $params);
        return array_column($rows, 'total', 'period');
    }

    public function classHistories(int $studentId): array
    {
        return $this->fetchAll(
            'SELECT h.*, c.name AS class_name, b.id AS branch_id, b.name AS branch_name
             FROM student_class_histories h
             JOIN classes c ON c.id = h.class_id
             JOIN branches b ON b.id = c.branch_id
             WHERE h.student_id = ?
             ORDER BY h.joined_at DESC, h.id DESC',
            [$studentId]
        );
    }

    public function branchHistories(int $studentId): array
    {
        return $this->fetchAll(
            'SELECT sbh.*, fb.name AS from_branch_name, tb.name AS to_branch_name, u.full_name AS performed_by_name
             FROM student_branch_histories sbh
             JOIN branches fb ON fb.id = sbh.from_branch_id
             JOIN branches tb ON tb.id = sbh.to_branch_id
             LEFT JOIN users u ON u.id = sbh.performed_by
             WHERE sbh.student_id = ?
             ORDER BY sbh.moved_at DESC, sbh.id DESC',
            [$studentId]
        );
    }

    public function createBranchHistory(array $data): int
    {
        return $this->insert([
            'student_id' => $data['student_id'],
            'from_branch_id' => $data['from_branch_id'],
            'to_branch_id' => $data['to_branch_id'],
            'moved_at' => $data['moved_at'],
            'reason' => $data['reason'] ?? null,
            'performed_by' => $data['performed_by'] ?? null,
        ]);
    }
}
