<?php
declare(strict_types=1);

namespace App\Repositories;

final class RoleRepository extends Repository
{
    protected string $table = 'roles';

    public function all(): array
    {
        return $this->fetchAll('SELECT * FROM roles ORDER BY id');
    }

    public function findByKey(string $roleKey): ?array
    {
        return $this->fetchOne('SELECT * FROM roles WHERE role_key = ? LIMIT 1', [$roleKey]);
    }

    public function permissionKeys(string $roleKey): array
    {
        $rows = $this->fetchAll(
            'SELECT p.permission_key
             FROM role_permissions rp
             JOIN permissions p ON p.id = rp.permission_id
             JOIN roles r ON r.id = rp.role_id
             WHERE r.role_key = ?
             ORDER BY p.permission_key',
            [$roleKey]
        );
        return array_column($rows, 'permission_key');
    }

    public function permissionsAll(): array
    {
        return $this->fetchAll('SELECT * FROM permissions ORDER BY module, permission_key');
    }
}
