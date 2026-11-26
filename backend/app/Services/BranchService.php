<?php
declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use App\Infrastructure\Storage\FileStorage;
use App\Models\Branch;
use App\Repositories\BranchRepository;

final class BranchService
{
    private BranchRepository $branches;
    private ActivityLogService $logs;

    public function __construct()
    {
        $this->branches = new BranchRepository();
        $this->logs = new ActivityLogService();
    }

    public function list(bool $onlyActive = false): array
    {
        return array_map(static fn (Branch $branch): array => [
            'id' => (int) $branch->id,
            'code' => $branch->code,
            'name' => $branch->name,
            'address' => $branch->address,
            'phone' => $branch->phone,
            'logo_path' => $branch->logo_path,
            'status' => $branch->status,
        ], $this->branches->all($onlyActive));
    }

    public function create(array $data, int $actorId): array
    {
        $code = strtoupper(trim((string) $data['code']));
        if ($this->branches->findByCode($code) !== null) {
            throw new HttpException(422, 'Mã cơ sở đã tồn tại');
        }
        $id = $this->branches->create([
            'code' => $code,
            'name' => trim((string) $data['name']),
            'address' => $data['address'] ?? null,
            'phone' => $data['phone'] ?? null,
            'status' => $data['status'] ?? 'active',
        ]);
        $this->logs->record('create', 'branches', 'branch', $id, 'Thêm cơ sở ' . $data['name'], null, $data);
        $branch = $this->branches->find($id);
        return $branch === null ? [] : [
            'id' => (int) $branch->id,
            'code' => $branch->code,
            'name' => $branch->name,
            'address' => $branch->address,
            'phone' => $branch->phone,
            'logo_path' => $branch->logo_path,
            'status' => $branch->status,
        ];
    }

    public function update(int $id, array $data, int $actorId): void
    {
        $branch = $this->branches->find($id);
        if ($branch === null) {
            throw new HttpException(404, 'Không tìm thấy cơ sở');
        }
        if (isset($data['code']) && $this->branches->findByCode((string) $data['code'], $id) !== null) {
            throw new HttpException(422, 'Mã cơ sở đã tồn tại');
        }
        $payload = [];
        foreach (['code', 'name', 'address', 'phone', 'status'] as $field) {
            if (array_key_exists($field, $data)) {
                $payload[$field] = $field === 'code' ? strtoupper(trim((string) $data[$field])) : $data[$field];
            }
        }
        if ($payload === []) {
            throw new HttpException(422, 'Không có dữ liệu cần cập nhật');
        }
        $this->branches->update($id, $payload);
        $this->logs->record('update', 'branches', 'branch', $id, 'Cập nhật cơ sở', $branch->toArray(), $payload);
    }

    public function updateLogo(int $id, array $file, int $actorId): string
    {
        $branch = $this->branches->find($id);
        if ($branch === null) {
            throw new HttpException(404, 'Không tìm thấy cơ sở');
        }
        $path = FileStorage::storeImage($file, 'branches');
        FileStorage::delete((string) $branch->logo_path);
        $this->branches->update($id, ['logo_path' => $path]);
        $this->logs->record('update_logo', 'branches', 'branch', $id, 'Cập nhật logo cơ sở');
        return $path;
    }
}
