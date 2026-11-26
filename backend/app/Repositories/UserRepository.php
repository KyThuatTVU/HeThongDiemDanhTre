<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\Model;
use App\Models\User;

final class UserRepository extends Repository
{
    protected string $table = 'users';
    protected string $model = User::class;

    private const SELECT = 'SELECT u.*, r.role_key, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id';

    public function findByLogin(string $identifier): ?User
    {
        $row = $this->fetchOne(
            self::SELECT . ' WHERE u.username = ? OR u.email = ? LIMIT 1',
            [$identifier, strtolower($identifier)]
        );
        return $row === null ? null : User::from($row);
    }

    public function findByEmail(string $email): ?User
    {
        $row = $this->fetchOne(self::SELECT . ' WHERE u.email = ? LIMIT 1', [strtolower($email)]);
        return $row === null ? null : User::from($row);
    }

    public function findByGoogleId(string $googleId): ?User
    {
        $row = $this->fetchOne(self::SELECT . ' WHERE u.google_id = ? LIMIT 1', [$googleId]);
        return $row === null ? null : User::from($row);
    }

    public function findWithRole(int $id): ?User
    {
        $row = $this->fetchOne(self::SELECT . ' WHERE u.id = ? LIMIT 1', [$id]);
        return $row === null ? null : User::from($row);
    }

    public function findByAvatarPath(string $path): ?array
    {
        return $this->fetchOne(
            self::SELECT . ' WHERE u.avatar_path = ? LIMIT 1',
            [$path]
        );
    }

    public function countActiveSuperAdmins(): int
    {
        return (int) $this->fetchValue(
            "SELECT COUNT(*) FROM users u
             JOIN roles r ON r.id = u.role_id
             WHERE r.role_key = 'super_admin' AND u.status = 'active'"
        );
    }

    public function find(int $id): ?Model
    {
        return $this->findWithRole($id);
    }

    public function branchIds(int $userId): array
    {
        return array_map('intval', array_column(
            $this->fetchAll('SELECT branch_id FROM user_branches WHERE user_id = ? ORDER BY branch_id', [$userId]),
            'branch_id'
        ));
    }

    public function create(array $data): int
    {
        return $this->insert($data);
    }

    public function update(int $id, array $data): int
    {
        return $this->updateById($id, $data);
    }

    public function setPassword(int $id, string $hash): void
    {
        $this->updateById($id, ['password_hash' => $hash]);
    }

    public function setStatus(int $id, string $status): void
    {
        $this->updateById($id, ['status' => $status]);
    }

    public function touchLogin(int $id): void
    {
        $this->execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [$id]);
    }

    public function linkGoogle(int $id, string $googleId): void
    {
        $this->updateById($id, ['google_id' => $googleId]);
    }

    public function setBranches(int $userId, array $branchIds): void
    {
        $this->execute('DELETE FROM user_branches WHERE user_id = ?', [$userId]);
        foreach (array_unique(array_map('intval', $branchIds)) as $branchId) {
            $this->execute(
                'INSERT INTO user_branches (user_id, branch_id) VALUES (?, ?)',
                [$userId, $branchId]
            );
        }
    }

    public function usernameExists(string $username, ?int $exceptId = null): bool
    {
        return $this->scalarExists('username', $username, $exceptId);
    }

    public function emailExists(string $email, ?int $exceptId = null): bool
    {
        return $this->scalarExists('email', strtolower($email), $exceptId);
    }

    private function scalarExists(string $column, string $value, ?int $exceptId): bool
    {
        if (!in_array($column, ['username', 'email'], true)) {
            throw new \InvalidArgumentException('Cột kiểm tra không hợp lệ: ' . $column);
        }
        $sql = "SELECT COUNT(*) FROM users WHERE `{$column}` = ?";
        $params = [$value];
        if ($exceptId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $exceptId;
        }
        return (int) $this->fetchValue($sql, $params) > 0;
    }

    public function staffList(array $filters, array $scopeBranchIds, int $page, int $perPage): array
    {
        $where = [];
        $params = [];

        if (!empty($filters['q'])) {
            $where[] = '(u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            array_push($params, $like, $like, $like, $like);
        }
        if (!empty($filters['role_key'])) {
            $where[] = 'r.role_key = ?';
            $params[] = $filters['role_key'];
        }
        if (!empty($filters['status'])) {
            $where[] = 'u.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['branch_id'])) {
            $where[] = 'EXISTS (SELECT 1 FROM user_branches ub1 WHERE ub1.user_id = u.id AND ub1.branch_id = ?)';
            $params[] = (int) $filters['branch_id'];
        }
        if ($scopeBranchIds !== []) {
            $placeholders = implode(',', array_fill(0, count($scopeBranchIds), '?'));
            $where[] = "EXISTS (SELECT 1 FROM user_branches ub2 WHERE ub2.user_id = u.id AND ub2.branch_id IN ({$placeholders}))";
            array_push($params, ...array_map('intval', $scopeBranchIds));
        }

        $whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);
        $total = (int) $this->fetchValue(
            'SELECT COUNT(DISTINCT u.id) FROM users u JOIN roles r ON r.id = u.role_id' . $whereSql,
            $params
        );
        $offset = ($page - 1) * $perPage;
        $rows = $this->fetchAll(
            'SELECT u.id, u.username, u.email, u.full_name, u.phone, u.avatar_path, u.status, u.last_login_at, u.created_at,
                    r.role_key, r.name AS role_name,
                    GROUP_CONCAT(DISTINCT b.name ORDER BY b.name SEPARATOR ", ") AS branch_names,
                    GROUP_CONCAT(DISTINCT b.id ORDER BY b.id) AS branch_ids
             FROM users u
             JOIN roles r ON r.id = u.role_id
             LEFT JOIN user_branches ub ON ub.user_id = u.id
             LEFT JOIN branches b ON b.id = ub.branch_id'
             . $whereSql .
            ' GROUP BY u.id, u.username, u.email, u.full_name, u.phone, u.avatar_path, u.status, u.last_login_at, u.created_at, r.role_key, r.name
              ORDER BY u.id DESC LIMIT ' . $perPage . ' OFFSET ' . $offset,
            $params
        );

        foreach ($rows as &$row) {
            $row['branch_ids'] = $row['branch_ids'] === null || $row['branch_ids'] === ''
                ? []
                : array_map('intval', explode(',', (string) $row['branch_ids']));
        }
        unset($row);

        return ['items' => $rows, 'total' => $total];
    }
}
