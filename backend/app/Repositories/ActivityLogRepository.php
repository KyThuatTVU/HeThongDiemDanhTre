<?php
declare(strict_types=1);

namespace App\Repositories;

final class ActivityLogRepository extends Repository
{
    protected string $table = 'activity_logs';

    public function create(array $data): int
    {
        return $this->insert($data);
    }

    public function paginate(array $filters, int $page, int $perPage): array
    {
        $where = [];
        $params = [];
        if (!empty($filters['user_id'])) {
            $where[] = 'al.user_id = ?';
            $params[] = (int) $filters['user_id'];
        }
        if (!empty($filters['module'])) {
            $where[] = 'al.module = ?';
            $params[] = $filters['module'];
        }
        if (!empty($filters['action'])) {
            $where[] = 'al.action = ?';
            $params[] = $filters['action'];
        }
        if (!empty($filters['date_from'])) {
            $where[] = 'al.created_at >= ?';
            $params[] = $filters['date_from'] . ' 00:00:00';
        }
        if (!empty($filters['date_to'])) {
            $where[] = 'al.created_at <= ?';
            $params[] = $filters['date_to'] . ' 23:59:59';
        }
        $whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);

        $total = (int) $this->fetchValue('SELECT COUNT(*) FROM activity_logs al' . $whereSql, $params);
        $offset = ($page - 1) * $perPage;
        $rows = $this->fetchAll(
            'SELECT al.*, u.full_name AS user_name
             FROM activity_logs al
             LEFT JOIN users u ON u.id = al.user_id'
             . $whereSql .
            ' ORDER BY al.id DESC LIMIT ' . $perPage . ' OFFSET ' . $offset,
            $params
        );
        return ['items' => $rows, 'total' => $total];
    }

    public function createLogin(array $data): int
    {
        $columns = array_keys($data);
        $sql = sprintf(
            'INSERT INTO login_histories (`%s`) VALUES (%s)',
            implode('`, `', $columns),
            implode(', ', array_map(static fn ($column): string => ':' . $column, $columns))
        );
        $params = [];
        foreach ($data as $column => $value) {
            $params[':' . $column] = $value;
        }
        $this->execute($sql, $params);
        return (int) $this->db()->lastInsertId();
    }

    public function loginHistory(array $filters, int $page, int $perPage): array
    {
        $where = [];
        $params = [];
        if (!empty($filters['user_id'])) {
            $where[] = 'lh.user_id = ?';
            $params[] = (int) $filters['user_id'];
        }
        if (!empty($filters['status'])) {
            $where[] = 'lh.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['date_from'])) {
            $where[] = 'lh.created_at >= ?';
            $params[] = $filters['date_from'] . ' 00:00:00';
        }
        if (!empty($filters['date_to'])) {
            $where[] = 'lh.created_at <= ?';
            $params[] = $filters['date_to'] . ' 23:59:59';
        }
        $whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);

        $total = (int) $this->fetchValue('SELECT COUNT(*) FROM login_histories lh' . $whereSql, $params);
        $offset = ($page - 1) * $perPage;
        $rows = $this->fetchAll(
            'SELECT lh.*, u.full_name AS user_name
             FROM login_histories lh
             LEFT JOIN users u ON u.id = lh.user_id'
             . $whereSql .
            ' ORDER BY lh.id DESC LIMIT ' . $perPage . ' OFFSET ' . $offset,
            $params
        );
        return ['items' => $rows, 'total' => $total];
    }
}
