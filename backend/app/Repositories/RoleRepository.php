<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Core\Config;
use App\Infrastructure\Cache\FileCache;

final class RoleRepository extends Repository
{
    protected string $table = 'roles';

    public function all(): array
    {
        return FileCache::remember(
            'roles.all',
            (int) Config::get('cache.ttl.permissions', 600),
            fn (): array => $this->fetchAll('SELECT * FROM roles ORDER BY id')
        );
    }

    public function findByKey(string $roleKey): ?array
    {
        return $this->fetchOne('SELECT * FROM roles WHERE role_key = ? LIMIT 1', [$roleKey]);
    }

    public function permissionKeys(string $roleKey): array
    {
        return FileCache::remember(
            'roles.permission_keys.' . $roleKey,
            (int) Config::get('cache.ttl.permissions', 600),
            fn (): array => array_column($this->fetchAll(
                'SELECT p.permission_key
                 FROM role_permissions rp
                 JOIN permissions p ON p.id = rp.permission_id
                 JOIN roles r ON r.id = rp.role_id
                 WHERE r.role_key = ?
                 ORDER BY p.permission_key',
                [$roleKey]
            ), 'permission_key')
        );
    }

    public function permissionsAll(): array
    {
        return FileCache::remember(
            'roles.permissions_all',
            (int) Config::get('cache.ttl.permissions', 600),
            fn (): array => $this->fetchAll('SELECT * FROM permissions ORDER BY module, permission_key')
        );
    }

    public function flushCache(): void
    {
        FileCache::forget(['roles.all', 'roles.permissions_all']);
        foreach ($this->all() as $role) {
            FileCache::forget('roles.permission_keys.' . (string) $role['role_key']);
        }
    }
}
