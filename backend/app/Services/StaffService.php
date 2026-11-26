<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\Session;
use App\Exceptions\HttpException;
use App\Infrastructure\Storage\FileStorage;
use App\Models\User;
use App\Repositories\BranchRepository;
use App\Repositories\RoleRepository;
use App\Repositories\UserRepository;

final class StaffService
{
    private UserRepository $users;
    private RoleRepository $roles;
    private BranchRepository $branches;
    private AuthorizationService $authz;
    private ActivityLogService $logs;

    public function __construct()
    {
        $this->users = new UserRepository();
        $this->roles = new RoleRepository();
        $this->branches = new BranchRepository();
        $this->authz = new AuthorizationService();
        $this->logs = new ActivityLogService();
    }

    public function list(array $filters, int $page, int $perPage): array
    {
        $scope = $this->authz->isSuperAdmin() ? [] : $this->authz->currentUserBranchIds();
        $result = $this->users->staffList($filters, $scope, $page, $perPage);
        return ['items' => $result['items'], 'total' => $result['total']];
    }

    public function detail(int $id): array
    {
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $this->assertStaffInScope($id);
        return [
            'user' => $this->sanitize($user),
            'branch_ids' => $this->users->branchIds($id),
        ];
    }

    private function assertStaffInScope(int $userId): void
    {
        if ($this->authz->isSuperAdmin()) {
            return;
        }
        $allowed = $this->authz->currentUserBranchIds();
        $target = $this->users->branchIds($userId);
        if (array_intersect($allowed, $target) === []) {
            throw new HttpException(403, 'Bạn không có quyền xem nhân viên ngoài cơ sở được phân công');
        }
    }

    public function create(array $data, int $actorId): array
    {
        $role = $this->roles->findByKey((string) $data['role_key']);
        if ($role === null) {
            throw new HttpException(422, 'Vai trò không hợp lệ');
        }
        $username = trim((string) $data['username']);
        if ($this->users->usernameExists($username)) {
            throw new HttpException(422, 'Tên đăng nhập đã tồn tại');
        }
        $email = isset($data['email']) && $data['email'] !== '' ? strtolower(trim((string) $data['email'])) : null;
        if ($email !== null && $this->users->emailExists($email)) {
            throw new HttpException(422, 'Email đã tồn tại');
        }
        $branchIds = $this->validateBranchIds($data['branch_ids'] ?? [], (string) $data['role_key']);

        $id = $this->users->create([
            'role_id' => (int) $role['id'],
            'username' => $username,
            'email' => $email,
            'password_hash' => password_hash((string) $data['password'], PASSWORD_DEFAULT),
            'full_name' => trim((string) $data['full_name']),
            'phone' => $data['phone'] ?? null,
            'status' => 'active',
        ]);
        $this->users->setBranches($id, $branchIds);
        $this->logs->record('create', 'staff', 'user', $id, 'Thêm nhân viên ' . $data['full_name']);
        return $this->detail($id);
    }

    public function update(int $id, array $data, int $actorId): array
    {
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $payload = [];
        foreach (['full_name', 'phone'] as $field) {
            if (array_key_exists($field, $data)) {
                $payload[$field] = $data[$field];
            }
        }
        if (array_key_exists('email', $data)) {
            $email = $data['email'] !== null && $data['email'] !== '' ? strtolower(trim((string) $data['email'])) : null;
            if ($email !== null && $this->users->emailExists($email, $id)) {
                throw new HttpException(422, 'Email đã tồn tại');
            }
            $payload['email'] = $email;
        }

        if (array_key_exists('role_key', $data) && $data['role_key'] !== '') {
            if ($id === $actorId && (string) $data['role_key'] !== (string) $user->role_key) {
                throw new HttpException(422, 'Không thể tự thay đổi vai trò của chính mình');
            }
            $role = $this->roles->findByKey((string) $data['role_key']);
            if ($role === null) {
                throw new HttpException(422, 'Vai trò không hợp lệ');
            }
            $payload['role_id'] = (int) $role['id'];
        }

        $branchIds = null;
        if (array_key_exists('branch_ids', $data)) {
            $roleKey = (string) ($data['role_key'] ?? $user->role_key);
            $branchIds = $this->validateBranchIds((array) $data['branch_ids'], $roleKey);
        }

        if ($payload === [] && $branchIds === null) {
            throw new HttpException(422, 'Không có dữ liệu cần cập nhật');
        }
        $old = $user->toArray();
        if ($payload !== []) {
            $this->users->update($id, $payload);
        }
        if ($branchIds !== null) {
            $this->users->setBranches($id, $branchIds);
        }
        $this->logs->record('update', 'staff', 'user', $id, 'Cập nhật nhân viên', $old, $payload);
        return $this->detail($id);
    }

    public function lock(int $id, int $actorId): void
    {
        $this->assertNotSelf($id, $actorId, 'Không thể tự khoá tài khoản của chính mình');
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $this->users->setStatus($id, 'locked');
        $this->logs->record('lock', 'staff', 'user', $id, 'Khoá tài khoản ' . $user->full_name);
    }

    public function unlock(int $id, int $actorId): void
    {
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $this->users->setStatus($id, 'active');
        $this->logs->record('unlock', 'staff', 'user', $id, 'Mở khoá tài khoản ' . $user->full_name);
    }

    public function resetPassword(int $id, string $newPassword, int $actorId): void
    {
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $this->users->setPassword($id, password_hash($newPassword, PASSWORD_DEFAULT));
        $this->logs->record('reset_password', 'staff', 'user', $id, 'Đặt lại mật khẩu cho ' . $user->full_name);
    }

    public function assignBranches(int $id, array $branchIds, int $actorId): array
    {
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $validated = $this->validateBranchIds($branchIds, (string) $user->role_key);
        $this->users->setBranches($id, $validated);
        $this->logs->record('assign_branches', 'staff', 'user', $id, 'Phân công cơ sở cho ' . $user->full_name, null, ['branch_ids' => $validated]);
        return ['branch_ids' => $validated];
    }

    public function updateAvatar(int $id, array $file, int $actorId): string
    {
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $path = FileStorage::storeImage($file, 'users');
        FileStorage::delete((string) $user->avatar_path);
        $this->users->update($id, ['avatar_path' => $path]);
        $this->logs->record('update_avatar', 'staff', 'user', $id, 'Cập nhật ảnh đại diện');
        return $path;
    }

    private function validateBranchIds(array $branchIds, string $roleKey): array
    {
        $branchIds = array_values(array_unique(array_map('intval', $branchIds)));
        if ($roleKey === 'super_admin') {
            return $branchIds;
        }
        if ($branchIds === []) {
            throw new HttpException(422, 'Vui lòng phân công ít nhất một cơ sở cho nhân viên');
        }
        if (count($branchIds) > 2) {
            throw new HttpException(422, 'Mỗi nhân viên chỉ được phân công tối đa 2 cơ sở');
        }
        $existing = $this->branches->ids();
        foreach ($branchIds as $branchId) {
            if (!in_array($branchId, $existing, true)) {
                throw new HttpException(422, 'Cơ sở được phân công không tồn tại');
            }
        }
        return $branchIds;
    }

    private function assertNotSelf(int $id, int $actorId, string $message): void
    {
        if ($id === $actorId) {
            throw new HttpException(422, $message);
        }
    }

    private function sanitize(User $user): array
    {
        return [
            'id' => (int) $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'full_name' => $user->full_name,
            'phone' => $user->phone,
            'avatar_path' => $user->avatar_path,
            'status' => $user->status,
            'last_login_at' => $user->last_login_at,
            'role_key' => $user->role_key,
            'role_name' => $user->role_name,
            'created_at' => $user->created_at,
        ];
    }
}
