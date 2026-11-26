<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\Session;
use App\Exceptions\HttpException;
use App\Models\Branch;
use App\Repositories\BranchRepository;
use App\Repositories\RoleRepository;
use App\Repositories\UserRepository;

final class AuthorizationService
{
    private static array $permissionCache = [];

    private UserRepository $users;
    private RoleRepository $roles;
    private BranchRepository $branches;

    public function __construct()
    {
        $this->users = new UserRepository();
        $this->roles = new RoleRepository();
        $this->branches = new BranchRepository();
    }

    public function roleKey(): ?string
    {
        $roleKey = Session::get('role_key');
        return is_string($roleKey) && $roleKey !== '' ? $roleKey : null;
    }

    public function isSuperAdmin(): bool
    {
        return $this->roleKey() === 'super_admin';
    }

    public function permissions(): array
    {
        $roleKey = $this->roleKey();
        if ($roleKey === null) {
            return [];
        }
        if (!isset(self::$permissionCache[$roleKey])) {
            self::$permissionCache[$roleKey] = $this->roles->permissionKeys($roleKey);
        }
        return self::$permissionCache[$roleKey];
    }

    public function can(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }
        return in_array($permission, $this->permissions(), true);
    }

    public function ensure(string $permission): void
    {
        if (!$this->can($permission)) {
            throw new HttpException(403, 'Bạn không có quyền thực hiện thao tác này');
        }
    }

    public function currentUserBranchIds(): array
    {
        if ($this->isSuperAdmin()) {
            return $this->branches->ids();
        }
        $userId = (int) Session::get('user_id', 0);
        return $userId > 0 ? $this->users->branchIds($userId) : [];
    }

    public function accessibleBranches(): array
    {
        $ids = $this->currentUserBranchIds();
        return array_values(array_filter(
            $this->branches->all(),
            static fn (Branch $branch): bool => in_array((int) $branch->id, $ids, true)
        ));
    }

    public function resolveBranch(?int $branchId): int
    {
        $ids = $this->currentUserBranchIds();
        if ($ids === []) {
            throw new HttpException(403, 'Tài khoản chưa được phân công cơ sở');
        }
        $candidate = $branchId !== null && $branchId > 0 ? $branchId : (int) Session::get('current_branch_id', 0);
        if ($candidate <= 0) {
            $candidate = (int) $ids[0];
        }
        if (!in_array($candidate, $ids, true)) {
            throw new HttpException(403, 'Bạn không được phân công làm việc tại cơ sở này');
        }
        return $candidate;
    }

    public function assertBranch(?int $branchId): void
    {
        if ($branchId === null || $branchId <= 0) {
            throw new HttpException(422, 'Vui lòng chọn cơ sở');
        }
        if (!in_array($branchId, $this->currentUserBranchIds(), true)) {
            throw new HttpException(403, 'Bạn không được phân công làm việc tại cơ sở này');
        }
    }
}
