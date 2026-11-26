<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Core\Config;
use App\Infrastructure\Cache\FileCache;

final class UserPermissionRepository extends Repository
{
    protected string $table = 'user_permissions';

    /** @return array<string, string> permission_key => effect (allow|deny) */
    public function overridesForUser(int $userId): array
    {
        return FileCache::remember(
            $this->cacheKey($userId),
            (int) Config::get('cache.ttl.user_permissions', 120),
            fn (): array => $this->loadOverrides($userId)
        );
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
        FileCache::forget($this->cacheKey($userId));
    }

    public function clearForUser(int $userId): void
    {
        $this->execute('DELETE FROM user_permissions WHERE user_id = ?', [$userId]);
        FileCache::forget($this->cacheKey($userId));
    }

    private function loadOverrides(int $userId): array
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

    private function cacheKey(int $userId): string
    {
        return 'user_permissions.' . $userId;
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
