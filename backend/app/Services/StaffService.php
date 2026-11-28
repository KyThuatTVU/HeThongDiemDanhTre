<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\Session;
use App\Exceptions\HttpException;
use App\Infrastructure\Security\PasswordPolicy;
use App\Infrastructure\Storage\FileStorage;
use App\Models\User;
use App\Repositories\BranchRepository;
use App\Repositories\RoleRepository;
use App\Repositories\UserPermissionRepository;
use App\Repositories\UserRepository;

final class StaffService
{
    private UserRepository $users;
    private RoleRepository $roles;
    private BranchRepository $branches;
    private UserPermissionRepository $userPermissions;
    private AuthorizationService $authz;
    private ActivityLogService $logs;

    public function __construct()
    {
        $this->users = new UserRepository();
        $this->roles = new RoleRepository();
        $this->branches = new BranchRepository();
        $this->userPermissions = new UserPermissionRepository();
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
        $roleKey = (string) $user->role_key;
        $isSuper = $roleKey === 'super_admin';
        return [
            'user' => $this->sanitize($user),
            'branch_ids' => $this->users->branchIds($id),
            'role_permission_keys' => $isSuper
                ? array_column($this->roles->permissionsAll(), 'permission_key')
                : $this->roles->permissionKeys($roleKey),
            'permission_keys' => $this->authz->effectivePermissions($id, $roleKey),
            'permission_overrides' => $isSuper ? [] : $this->userPermissions->overridesForUser($id),
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
        $roleKey = (string) $data['role_key'];
        $this->assertCanAssignRole($roleKey);
        $role = $this->roles->findByKey($roleKey);
        if ($role === null) {
            throw new HttpException(422, 'Vai trò không hợp lệ');
        }
        PasswordPolicy::assertValid((string) $data['password']);
        $username = trim((string) $data['username']);
        if ($this->users->usernameExists($username)) {
            throw new HttpException(422, 'Tên đăng nhập đã tồn tại');
        }
        $email = isset($data['email']) && $data['email'] !== '' ? strtolower(trim((string) $data['email'])) : null;
        if ($email !== null && $this->users->emailExists($email)) {
            throw new HttpException(422, 'Email đã tồn tại');
        }
        $branchIds = $this->validateBranchIds($data['branch_ids'] ?? [], $roleKey);
        $permissionKeys = null;
        if (array_key_exists('permission_keys', $data)) {
            $this->assertCanAssignPermissions();
            $permissionKeys = $this->normalizePermissionKeys((array) $data['permission_keys']);
            if ($roleKey === 'super_admin' && $permissionKeys !== []) {
                throw new HttpException(422, 'Quản trị hệ thống luôn có toàn bộ quyền, không thể chỉnh riêng');
            }
        }

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
        if ($permissionKeys !== null) {
            $this->applyPermissionOverrides($id, (string) $data['role_key'], $permissionKeys);
            $this->logs->record('assign_permissions', 'staff', 'user', $id, 'Phân quyền chi tiết khi tạo tài khoản');
        }
        $this->logs->record('create', 'staff', 'user', $id, 'Thêm nhân viên ' . $data['full_name']);
        return $this->detail($id);
    }

    public function update(int $id, array $data, int $actorId): array
    {
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $this->assertCanManageTarget($user);
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
            $newRoleKey = (string) $data['role_key'];
            if ($id === $actorId && $newRoleKey !== (string) $user->role_key) {
                throw new HttpException(422, 'Không thể tự thay đổi vai trò của chính mình');
            }
            $this->assertCanAssignRole($newRoleKey);
            $role = $this->roles->findByKey($newRoleKey);
            if ($role === null) {
                throw new HttpException(422, 'Vai trò không hợp lệ');
            }
            $payload['role_id'] = (int) $role['id'];
        }

        $roleChanged = array_key_exists('role_id', $payload) && (int) $payload['role_id'] !== (int) $user->role_id;
        $finalRoleKey = $roleChanged ? (string) $data['role_key'] : (string) $user->role_key;
        if ($roleChanged && (string) $user->role_key === 'super_admin' && $finalRoleKey !== 'super_admin') {
            $this->assertNotLastSuperAdmin($user);
        }
        $hasPermissionPayload = array_key_exists('permission_keys', $data);
        $permissionKeys = null;
        if ($hasPermissionPayload) {
            $this->assertCanAssignPermissions();
            $permissionKeys = $this->normalizePermissionKeys((array) $data['permission_keys']);
            if ($finalRoleKey === 'super_admin' && $permissionKeys !== []) {
                throw new HttpException(422, 'Quản trị hệ thống luôn có toàn bộ quyền, không thể chỉnh riêng');
            }
        }

        $branchIds = null;
        if (array_key_exists('branch_ids', $data)) {
            $roleKey = (string) ($data['role_key'] ?? $user->role_key);
            $branchIds = $this->validateBranchIds((array) $data['branch_ids'], $roleKey);
        }

        if ($payload === [] && $branchIds === null && !$hasPermissionPayload) {
            throw new HttpException(422, 'Không có dữ liệu cần cập nhật');
        }
        $old = $user->toArray();
        if ($payload !== []) {
            $this->users->update($id, $payload);
        }
        if ($branchIds !== null) {
            $this->users->setBranches($id, $branchIds);
        }
        if ($roleChanged) {
            $this->userPermissions->clearForUser($id);
        }
        if ($hasPermissionPayload) {
            $this->applyPermissionOverrides($id, $finalRoleKey, (array) $permissionKeys);
            $this->logs->record('assign_permissions', 'staff', 'user', $id, 'Cập nhật quyền chi tiết cho ' . $user->full_name);
        }
        $this->logs->record('update', 'staff', 'user', $id, 'Cập nhật nhân viên', $old, $payload);
        return $this->detail($id);
    }

    public function assignPermissions(int $id, array $permissionKeys, int $actorId): array
    {
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $this->assertCanAssignPermissions();
        $this->applyPermissionOverrides($id, (string) $user->role_key, $permissionKeys);
        $this->logs->record('assign_permissions', 'staff', 'user', $id, 'Cập nhật quyền chi tiết cho ' . $user->full_name);
        return $this->detail($id);
    }

    public function permissionCatalog(): array
    {
        $allPermissions = $this->roles->permissionsAll();
        $permissions = array_map(static fn (array $row): array => [
            'key' => (string) $row['permission_key'],
            'name' => (string) $row['name'],
            'module' => (string) $row['module'],
        ], $allPermissions);

        $roles = [];
        foreach ($this->roles->all() as $role) {
            $roleKey = (string) $role['role_key'];
            $roles[] = [
                'key' => $roleKey,
                'name' => (string) $role['name'],
                'permission_keys' => $roleKey === 'super_admin'
                    ? array_column($allPermissions, 'permission_key')
                    : $this->roles->permissionKeys($roleKey),
            ];
        }
        return ['permissions' => $permissions, 'roles' => $roles];
    }

    public function lock(int $id, int $actorId): void
    {
        $this->assertNotSelf($id, $actorId, 'Không thể tự khoá tài khoản của chính mình');
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $this->assertCanManageTarget($user);
        $this->assertNotLastSuperAdmin($user);
        $this->users->setStatus($id, 'locked');
        (new RememberMeService())->revokeAllForUser($id);
        $this->logs->record('lock', 'staff', 'user', $id, 'Khoá tài khoản ' . $user->full_name);
    }

    public function unlock(int $id, int $actorId): void
    {
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $this->assertCanManageTarget($user);
        $this->users->setStatus($id, 'active');
        $this->logs->record('unlock', 'staff', 'user', $id, 'Mở khoá tài khoản ' . $user->full_name);
    }

    public function resetPassword(int $id, string $newPassword, int $actorId): void
    {
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $this->assertCanManageTarget($user);
        PasswordPolicy::assertValid($newPassword);
        $hash = password_hash($newPassword, PASSWORD_DEFAULT);
        $this->users->setPassword($id, $hash);
        (new RememberMeService())->revokeAllForUser($id);
        if ($id === $actorId) {
            Session::set('password_fingerprint', hash('sha256', $hash));
        }
        $this->logs->record('reset_password', 'staff', 'user', $id, 'Đặt lại mật khẩu cho ' . $user->full_name);
    }

    public function assignBranches(int $id, array $branchIds, int $actorId): array
    {
        $user = $this->users->findWithRole($id);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy nhân viên');
        }
        $this->assertCanManageTarget($user);
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
        $this->assertCanManageTarget($user);
        $path = FileStorage::storeImage($file, 'users');
        FileStorage::delete((string) $user->avatar_path);
        $this->users->update($id, ['avatar_path' => $path]);
        $this->logs->record('update_avatar', 'staff', 'user', $id, 'Cập nhật ảnh đại diện');
        return $path;
    }

    private function assertCanAssignPermissions(): void
    {
        if (!$this->authz->isSuperAdmin()) {
            throw new HttpException(403, 'Chỉ quản trị hệ thống được phân quyền chi tiết cho nhân viên');
        }
    }

    private function applyPermissionOverrides(int $userId, string $roleKey, array $permissionKeys): void
    {
        if ($roleKey === 'super_admin') {
            if ($permissionKeys !== []) {
                throw new HttpException(422, 'Quản trị hệ thống luôn có toàn bộ quyền, không thể chỉnh riêng');
            }
            $this->userPermissions->clearForUser($userId);
            return;
        }
        $keys = $this->normalizePermissionKeys($permissionKeys);
        $base = $this->roles->permissionKeys($roleKey);
        $allow = array_values(array_diff($keys, $base));
        $deny = array_values(array_diff($base, $keys));
        $this->userPermissions->replaceForUser($userId, $allow, $deny);
    }

    private function normalizePermissionKeys(array $keys): array
    {
        $allowed = array_column($this->roles->permissionsAll(), 'permission_key');
        $clean = [];
        foreach ($keys as $key) {
            $key = trim((string) $key);
            if ($key === '') {
                continue;
            }
            if (!in_array($key, $allowed, true)) {
                throw new HttpException(422, 'Quyền không hợp lệ: ' . $key);
            }
            $clean[$key] = true;
        }
        $clean = array_keys($clean);
        sort($clean);
        return $clean;
    }

    private function validateBranchIds(array $branchIds, string $roleKey): array
    {
        $branchIds = array_values(array_unique(array_map('intval', $branchIds)));
        if ($roleKey === 'super_admin') {
            if (!$this->authz->isSuperAdmin()) {
                throw new HttpException(403, 'Chỉ quản trị hệ thống được cấp vai trò quản trị hệ thống');
            }
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
        if (!$this->authz->isSuperAdmin()) {
            $allowed = $this->authz->currentUserBranchIds();
            foreach ($branchIds as $branchId) {
                if (!in_array($branchId, $allowed, true)) {
                    throw new HttpException(403, 'Bạn chỉ được phân công nhân viên vào cơ sở mình quản lý');
                }
            }
        }
        return $branchIds;
    }

    private function assertCanAssignRole(string $roleKey): void
    {
        if ($roleKey === 'super_admin' && !$this->authz->isSuperAdmin()) {
            throw new HttpException(403, 'Chỉ quản trị hệ thống được cấp vai trò quản trị hệ thống');
        }
    }

    private function assertCanManageTarget(User $user): void
    {
        if ($this->authz->isSuperAdmin()) {
            return;
        }
        if ((string) $user->role_key === 'super_admin') {
            throw new HttpException(403, 'Chỉ quản trị hệ thống được thao tác trên tài khoản quản trị hệ thống');
        }
        $this->assertStaffInScope((int) $user->id);
    }

    private function assertNotLastSuperAdmin(User $user): void
    {
        if ((string) $user->role_key !== 'super_admin') {
            return;
        }
        if ($this->users->countActiveSuperAdmins() > 1) {
            return;
        }
        throw new HttpException(422, 'Không thể khoá hoặc hạ cấp quản trị hệ thống cuối cùng');
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
