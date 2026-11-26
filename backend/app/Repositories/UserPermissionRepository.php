<?php
declare(strict_types=1);

namespace App\Repositories;

final class UserPermissionRepository extends Repository
{
    protected string $table = 'user_permissions';

    /** @return array<string, string> permission_key => effect (allow|deny) */
    public function overridesForUser(int $userId): array
    {
        $rows = $this->fetchAll(
            'SELECT p.permission_key, up.effect
             FROM user_permissions up
             JOIN permissions p ON p.id = up.permission_id
             WHERE up.user_id = ?',
            [$userId]
        );
        $overrides = [];
        foreach ($rows as $row) {
            $overrides[(string) $row['permission_key']] = (string) $row['effect'];
        }
        return $overrides;
    }

    public function replaceForUser(int $userId, array $allowKeys, array $denyKeys): void
    {
        $pdo = $this->db();
        $pdo->beginTransaction();
        try {
            $this->execute('DELETE FROM user_permissions WHERE user_id = ?', [$userId]);
            $this->insertKeys($userId, $allowKeys, 'allow');
            $this->insertKeys($userId, $denyKeys, 'deny');
            $pdo->commit();
        } catch (\Throwable $exception) {
            $pdo->rollBack();
            throw $exception;
        }
    }

    public function clearForUser(int $userId): void
    {
        $this->execute('DELETE FROM user_permissions WHERE user_id = ?', [$userId]);
    }

    private function insertKeys(int $userId, array $keys, string $effect): void
    {
        foreach (array_unique($keys) as $key) {
            $this->execute(
                'INSERT INTO user_permissions (user_id, permission_id, effect)
                 SELECT ?, id, ? FROM permissions WHERE permission_key = ?',
                [$userId, $effect, $key]
            );
        }
    }
}
