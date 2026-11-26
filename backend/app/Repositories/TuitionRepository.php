<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\TuitionRecord;

final class TuitionRepository extends Repository
{
    protected string $table = 'tuition_records';

    private const SELECT = 'SELECT t.*, s.student_code, s.full_name AS student_name, c.name AS class_name, b.name AS branch_name
        FROM tuition_records t
        JOIN students s ON s.id = t.student_id
        LEFT JOIN classes c ON c.id = s.current_class_id
        JOIN branches b ON b.id = t.branch_id';

    public function findByStudentPeriod(int $studentId, int $year, int $month): ?array
    {
        return $this->fetchOne(
            'SELECT * FROM tuition_records WHERE student_id = ? AND period_year = ? AND period_month = ? LIMIT 1',
            [$studentId, $year, $month]
        );
    }

    public function findDetail(int $id): ?TuitionRecord
    {
        $row = $this->fetchOne(self::SELECT . ' WHERE t.id = ? LIMIT 1', [$id]);
        return $row === null ? null : TuitionRecord::from($row);
    }

    public function create(array $data): int
    {
        return $this->insert($data);
    }

    public function update(int $id, array $data): int
    {
        return $this->updateById($id, $data);
    }

    public function board(array $filters, int $page, int $perPage): array
    {
        [$whereSql, $params] = $this->boardWhere($filters);
        $total = (int) $this->fetchValue(
            'SELECT COUNT(*) FROM tuition_records t JOIN students s ON s.id = t.student_id
             JOIN branches b ON b.id = t.branch_id LEFT JOIN classes c ON c.id = s.current_class_id' . $whereSql,
            $params
        );
        $totalsRow = $this->fetchOne(
            'SELECT COALESCE(SUM(final_amount), 0) AS final_total, COALESCE(SUM(paid_amount), 0) AS paid_total
             FROM tuition_records t JOIN students s ON s.id = t.student_id
             JOIN branches b ON b.id = t.branch_id LEFT JOIN classes c ON c.id = s.current_class_id' . $whereSql,
            $params
        );
        $offset = ($page - 1) * $perPage;
        $rows = $this->fetchAll(
            self::SELECT . $whereSql . ' ORDER BY s.full_name LIMIT ' . $perPage . ' OFFSET ' . $offset,
            $params
        );
        return [
            'items' => array_map(static fn (array $row): TuitionRecord => TuitionRecord::from($row), $rows),
            'total' => $total,
            'totals' => [
                'final_total' => (float) ($totalsRow['final_total'] ?? 0),
                'paid_total' => (float) ($totalsRow['paid_total'] ?? 0),
                'debt_total' => (float) (($totalsRow['final_total'] ?? 0) - ($totalsRow['paid_total'] ?? 0)),
            ],
        ];
    }

    public function allForReport(array $filters): array
    {
        [$whereSql, $params] = $this->boardWhere($filters);
        return $this->fetchAll(self::SELECT . $whereSql . ' ORDER BY b.name, s.full_name', $params);
    }

    private function boardWhere(array $filters): array
    {
        $where = ['t.branch_id = ?', 't.period_year = ?', 't.period_month = ?'];
        $params = [(int) $filters['branch_id'], (int) $filters['year'], (int) $filters['month']];
        if (!empty($filters['status'])) {
            $where[] = 't.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['q'])) {
            $where[] = '(s.student_code LIKE ? OR s.full_name LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            array_push($params, $like, $like);
        }
        return [' WHERE ' . implode(' AND ', $where), $params];
    }

    public function existingStudentIds(int $branchId, int $year, int $month): array
    {
        return array_map('intval', array_column(
            $this->fetchAll(
                'SELECT student_id FROM tuition_records WHERE branch_id = ? AND period_year = ? AND period_month = ?',
                [$branchId, $year, $month]
            ),
            'student_id'
        ));
    }

    public function adjustments(int $recordId): array
    {
        return $this->fetchAll(
            'SELECT a.*, u.full_name AS created_by_name
             FROM tuition_adjustments a LEFT JOIN users u ON u.id = a.created_by
             WHERE a.tuition_record_id = ? ORDER BY a.id DESC',
            [$recordId]
        );
    }

    public function addAdjustment(int $recordId, float $amount, string $reason, int $userId): int
    {
        return $this->insert([
            'tuition_record_id' => $recordId,
            'amount' => $amount,
            'reason' => $reason,
            'created_by' => $userId,
        ]);
    }

    public function sumAdjustments(int $recordId): float
    {
        return (float) $this->fetchValue(
            'SELECT COALESCE(SUM(amount), 0) FROM tuition_adjustments WHERE tuition_record_id = ?',
            [$recordId]
        );
    }

    public function payments(int $recordId): array
    {
        return $this->fetchAll(
            'SELECT p.*, u.full_name AS received_by_name
             FROM tuition_payments p LEFT JOIN users u ON u.id = p.received_by
             WHERE p.tuition_record_id = ? ORDER BY p.paid_on DESC, p.id DESC',
            [$recordId]
        );
    }

    public function addPayment(int $recordId, float $amount, string $paidOn, string $method, ?string $note, int $userId): int
    {
        return $this->insert([
            'tuition_record_id' => $recordId,
            'amount' => $amount,
            'paid_on' => $paidOn,
            'method' => $method,
            'note' => $note,
            'received_by' => $userId,
        ]);
    }

    public function sumPayments(int $recordId): float
    {
        return (float) $this->fetchValue(
            'SELECT COALESCE(SUM(amount), 0) FROM tuition_payments WHERE tuition_record_id = ?',
            [$recordId]
        );
    }

    public function recentByStudent(int $studentId, int $limit = 6): array
    {
        return $this->fetchAll(
            'SELECT * FROM tuition_records WHERE student_id = ? ORDER BY period_year DESC, period_month DESC LIMIT ' . max(1, $limit),
            [$studentId]
        );
    }
}
