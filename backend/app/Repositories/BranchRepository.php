<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Core\Config;
use App\Infrastructure\Cache\FileCache;
use App\Models\Branch;
use App\Models\Model;

final class BranchRepository extends Repository
{
    private const CACHE_KEYS = ['branches.all.any', 'branches.all.active', 'branches.ids'];

    protected string $table = 'branches';
    protected string $model = Branch::class;

    public function all(bool $onlyActive = false): array
    {
        $rows = FileCache::remember(
            $onlyActive ? 'branches.all.active' : 'branches.all.any',
            (int) Config::get('cache.ttl.branches', 600),
            fn (): array => $this->fetchAll(
                'SELECT * FROM branches' . ($onlyActive ? " WHERE status = 'active'" : '') . ' ORDER BY name'
            )
        );
        return array_map(static fn (array $row): Branch => Branch::from($row), $rows);
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
        return FileCache::remember(
            'branches.ids',
            (int) Config::get('cache.ttl.branches', 600),
            fn (): array => array_map('intval', array_column(
                $this->fetchAll('SELECT id FROM branches ORDER BY id'),
                'id'
            ))
        );
    }

    public function create(array $data): int
    {
        $id = $this->insert($data);
        $this->flushCache();
        return $id;
    }

    public function update(int $id, array $data): int
    {
        $affected = $this->updateById($id, $data);
        $this->flushCache();
        return $affected;
    }

    private function flushCache(): void
    {
        FileCache::forget(self::CACHE_KEYS);
    }
}
