<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\Branch;
use App\Models\Model;

final class BranchRepository extends Repository
{
    protected string $table = 'branches';
    protected string $model = Branch::class;

    public function all(bool $onlyActive = false): array
    {
        $sql = 'SELECT * FROM branches' . ($onlyActive ? " WHERE status = 'active'" : '') . ' ORDER BY name';
        return array_map(static fn (array $row): Branch => Branch::from($row), $this->fetchAll($sql));
    }

    public function find(int $id): ?Model
    {
        return $this->hydrate($this->fetchOne('SELECT * FROM branches WHERE id = ? LIMIT 1', [$id]));
    }

    public function findByCode(string $code, ?int $exceptId = null): ?array
    {
        $sql = 'SELECT * FROM branches WHERE code = ?';
        $params = [$code];
        if ($exceptId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $exceptId;
        }
        return $this->fetchOne($sql . ' LIMIT 1', $params);
    }

    public function ids(): array
    {
        return array_map('intval', array_column($this->fetchAll('SELECT id FROM branches ORDER BY id'), 'id'));
    }

    public function create(array $data): int
    {
        return $this->insert($data);
    }

    public function update(int $id, array $data): int
    {
        return $this->updateById($id, $data);
    }
}
