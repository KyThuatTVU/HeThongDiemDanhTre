<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\Request;
use App\Core\Session;
use App\Exceptions\HttpException;
use App\Infrastructure\Auth\GoogleOAuthClient;
use App\Models\User;
use App\Repositories\BranchRepository;
use App\Repositories\UserRepository;

final class AuthService
{
    private UserRepository $users;
    private BranchRepository $branches;
    private ActivityLogService $logs;
    private GoogleOAuthClient $google;

    public function __construct()
    {
        $this->users = new UserRepository();
        $this->branches = new BranchRepository();
        $this->logs = new ActivityLogService();
        $this->google = new GoogleOAuthClient();
    }

    public function loginWithPassword(Request $request, string $identifier, string $password): array
    {
        $identifier = trim($identifier);
        $user = $this->users->findByLogin($identifier);
        if ($user === null || (string) $user->password_hash === '') {
            $this->logs->recordLogin(null, $identifier, 'password', 'failed');
            throw new HttpException(401, 'Tài khoản hoặc mật khẩu không đúng');
        }
        if ((string) $user->status !== 'active') {
            $this->logs->recordLogin((int) $user->id, $identifier, 'password', 'failed');
            throw new HttpException(403, 'Tài khoản đã bị khoá, vui lòng liên hệ quản trị viên');
        }
        if (!password_verify($password, (string) $user->password_hash)) {
            $this->logs->recordLogin((int) $user->id, $identifier, 'password', 'failed');
            throw new HttpException(401, 'Tài khoản hoặc mật khẩu không đúng');
        }
        return $this->establishSession($user, $identifier, 'password');
    }

    public function googleAuthUrl(): string
    {
        $state = bin2hex(random_bytes(16));
        Session::set('google_oauth_state', $state);
        return $this->google->buildAuthUrl($state);
    }

    public function loginWithGoogle(string $code, string $state): array
    {
        $expectedState = (string) Session::get('google_oauth_state', '');
        Session::forget('google_oauth_state');
        if ($expectedState === '' || $state === '' || !hash_equals($expectedState, $state)) {
            throw new HttpException(400, 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn');
        }
        $profile = $this->google->fetchUser($code);
        $email = (string) $profile['email'];

        $allowedEmails = (array) Config::get('auth.google.allowed_emails', []);
        if ($allowedEmails !== [] && !in_array(strtolower($email), $allowedEmails, true)) {
            $this->logs->recordLogin(null, $email, 'google', 'failed');
            throw new HttpException(403, 'Email Google không nằm trong danh sách được phép đăng nhập');
        }

        $user = $this->users->findByGoogleId((string) $profile['google_id']) ?? $this->users->findByEmail($email);
        if ($user === null) {
            $this->logs->recordLogin(null, $email, 'google', 'failed');
            throw new HttpException(403, 'Email Google chưa được cấp tài khoản trong hệ thống');
        }
        if ((string) $user->status !== 'active') {
            $this->logs->recordLogin((int) $user->id, $email, 'google', 'failed');
            throw new HttpException(403, 'Tài khoản đã bị khoá');
        }
        if ((string) $user->role_key !== 'super_admin') {
            $this->logs->recordLogin((int) $user->id, $email, 'google', 'failed');
            throw new HttpException(403, 'Chỉ Super Admin được đăng nhập bằng Google');
        }
        if ((string) $user->google_id === '') {
            $this->users->linkGoogle((int) $user->id, (string) $profile['google_id']);
            $user->google_id = $profile['google_id'];
        } elseif ((string) $user->google_id !== (string) $profile['google_id']) {
            $this->logs->recordLogin((int) $user->id, $email, 'google', 'failed');
            throw new HttpException(403, 'Tài khoản Google không khớp với hồ sơ nhân sự');
        }

        return $this->establishSession($user, $email, 'google');
    }

    private function establishSession(User $user, string $identifier, string $method): array
    {
        Session::regenerate();
        Session::set('user_id', (int) $user->id);
        Session::set('role_key', (string) $user->role_key);

        $branchIds = (string) $user->role_key === 'super_admin'
            ? $this->branches->ids()
            : $this->users->branchIds((int) $user->id);
        $currentBranchId = $branchIds[0] ?? null;
        Session::set('branch_ids', $branchIds);
        Session::set('current_branch_id', $currentBranchId);
        Session::set('_csrf', bin2hex(random_bytes(32)));

        $this->users->touchLogin((int) $user->id);
        $this->logs->recordLogin((int) $user->id, $identifier, $method, 'success');
        $this->logs->record('login', 'auth', 'user', (int) $user->id, 'Đăng nhập bằng ' . $method);

        return $this->payload($user);
    }

    public function payload(?User $user = null): array
    {
        $userId = $user !== null ? (int) $user->id : (int) Session::get('user_id', 0);
        $user ??= $this->users->findWithRole($userId);
        if ($user === null) {
            throw new HttpException(401, 'Chưa đăng nhập');
        }
        $roleKey = (string) $user->role_key;
        $permissions = (new AuthorizationService())->effectivePermissions($userId, $roleKey);
        $branchIds = $roleKey === 'super_admin'
            ? $this->branches->ids()
            : $this->users->branchIds($userId);
        $branches = array_values(array_filter(
            $this->branches->all(true),
            static fn ($branch): bool => in_array((int) $branch->id, $branchIds, true)
        ));

        return [
            'user' => [
                'id' => (int) $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'full_name' => $user->full_name,
                'phone' => $user->phone,
                'avatar_path' => $user->avatar_path,
                'status' => $user->status,
                'last_login_at' => $user->last_login_at,
            ],
            'role' => ['key' => $roleKey, 'name' => $user->role_name],
            'permissions' => $permissions,
            'branches' => array_map(static fn ($branch): array => [
                'id' => (int) $branch->id,
                'code' => $branch->code,
                'name' => $branch->name,
                'logo_path' => $branch->logo_path,
            ], $branches),
            'current_branch_id' => Session::get('current_branch_id'),
            'google_login_enabled' => (new GoogleOAuthClient())->isConfigured(),
            'csrf_token' => Session::csrfToken(),
        ];
    }

    public function selectBranch(int $branchId): array
    {
        $authz = new AuthorizationService();
        $authz->assertBranch($branchId);
        Session::set('current_branch_id', $branchId);
        $this->logs->record('select_branch', 'auth', 'branch', $branchId, 'Chọn cơ sở làm việc');
        return ['current_branch_id' => $branchId];
    }

    public function logout(): void
    {
        $userId = (int) Session::get('user_id', 0);
        if ($userId > 0) {
            $this->logs->record('logout', 'auth', 'user', $userId, 'Đăng xuất');
        }
        Session::destroy();
    }

    public function changePassword(int $userId, string $currentPassword, string $newPassword): void
    {
        $user = $this->users->findWithRole($userId);
        if ($user === null) {
            throw new HttpException(404, 'Không tìm thấy tài khoản');
        }
        if ((string) $user->password_hash === '' || !password_verify($currentPassword, (string) $user->password_hash)) {
            throw new HttpException(422, 'Mật khẩu hiện tại không đúng');
        }
        $this->users->setPassword($userId, password_hash($newPassword, PASSWORD_DEFAULT));
        $this->logs->record('change_password', 'staff', 'user', $userId, 'Đổi mật khẩu cá nhân');
    }

    public function updateProfile(int $userId, string $fullName, ?string $phone): array
    {
        $this->users->update($userId, ['full_name' => $fullName, 'phone' => $phone]);
        $this->logs->record('update_profile', 'staff', 'user', $userId, 'Cập nhật thông tin cá nhân');
        return $this->payload();
    }
}
