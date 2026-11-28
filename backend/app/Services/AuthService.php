<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\Request;
use App\Core\Session;
use App\Exceptions\HttpException;
use App\Infrastructure\Auth\GoogleOAuthClient;
use App\Infrastructure\Security\PasswordPolicy;
use App\Infrastructure\Security\RateLimiter;
use App\Models\User;
use App\Repositories\BranchRepository;
use App\Repositories\UserRepository;

final class AuthService
{
    private const DUMMY_PASSWORD_HASH = '$2y$10$Vq2Td2nz.zEBzDjhxFDbgOGP3ZMEj7p5mGyA29s9UFfQSFCthNFG6';

    private UserRepository $users;
    private BranchRepository $branches;
    private ActivityLogService $logs;
    private GoogleOAuthClient $google;
    private RememberMeService $rememberMe;

    public function __construct()
    {
        $this->users = new UserRepository();
        $this->branches = new BranchRepository();
        $this->logs = new ActivityLogService();
        $this->google = new GoogleOAuthClient();
        $this->rememberMe = new RememberMeService();
    }

    public function loginWithPassword(Request $request, string $identifier, string $password, bool $remember = false): array
    {
        $identifier = trim($identifier);
        $user = $this->users->findByLogin($identifier);
        $hash = $user !== null ? (string) $user->password_hash : '';
        if ($hash === '') {
            $hash = self::DUMMY_PASSWORD_HASH;
        }
        $valid = password_verify($password, $hash);
        if ($user === null || !$valid) {
            $this->logs->recordLogin($user !== null ? (int) $user->id : null, $identifier, 'password', 'failed');
            throw new HttpException(401, 'Tài khoản hoặc mật khẩu không đúng');
        }
        if ((string) $user->status !== 'active') {
            $this->logs->recordLogin((int) $user->id, $identifier, 'password', 'failed');
            throw new HttpException(403, 'Tài khoản đã bị khoá, vui lòng liên hệ quản trị viên');
        }
        RateLimiter::clear('login', 'ip', $request->ip());
        RateLimiter::clear('login', 'account', $identifier);
        return $this->establishSession($user, $identifier, 'password', $remember, $request);
    }

    public function googleAuthUrl(): string
    {
        if (!$this->googleLoginEnabled()) {
            throw new HttpException(503, 'Đăng nhập Google chưa được cấu hình cho tài khoản quản trị');
        }
        $state = bin2hex(random_bytes(16));
        Session::set('google_oauth_state', $state);
        return $this->google->buildAuthUrl($state);
    }

    public function googleLoginEnabled(): bool
    {
        return $this->google->isConfigured() && $this->allowedGoogleEmails() !== [];
    }

    public function loginWithGoogle(string $code, string $state): array
    {
        $expectedState = (string) Session::get('google_oauth_state', '');
        Session::forget('google_oauth_state');
        if ($expectedState === '' || $state === '' || !hash_equals($expectedState, $state)) {
            throw new HttpException(400, 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn');
        }
        $profile = $this->google->fetchUser($code);
        $email = strtolower((string) $profile['email']);

        $allowedEmails = $this->allowedGoogleEmails();
        if ($allowedEmails === [] || !in_array($email, $allowedEmails, true)) {
            $this->logs->recordLogin(null, $email, 'google', 'failed');
            throw new HttpException(403, 'Tài khoản Google này không được phép truy cập trang quản trị');
        }
        if (($profile['email_verified'] ?? false) !== true) {
            $this->logs->recordLogin(null, $email, 'google', 'failed');
            throw new HttpException(403, 'Email Google chưa được xác minh');
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

        $googleName = mb_substr(trim((string) ($profile['name'] ?? '')), 0, 120);
        if ($googleName !== '' && $googleName !== (string) $user->full_name) {
            $this->users->update((int) $user->id, ['full_name' => $googleName]);
            $user->full_name = $googleName;
        }

        return $this->establishSession($user, $email, 'google');
    }

    private function allowedGoogleEmails(): array
    {
        return array_values(array_unique(array_filter(array_map(
            static fn ($email): string => strtolower(trim((string) $email)),
            (array) Config::get('auth.google.allowed_emails', [])
        ), static fn (string $email): bool => $email !== '')));
    }

    private function establishSession(User $user, string $identifier, string $method, bool $remember = false, ?Request $request = null): array
    {
        Session::regenerate();
        Session::set('user_id', (int) $user->id);
        Session::set('role_key', (string) $user->role_key);
        Session::set('password_fingerprint', hash('sha256', (string) $user->password_hash));
        Session::set('last_activity', time());
        Session::set('remembered', $remember);

        $branchIds = (string) $user->role_key === 'super_admin'
            ? $this->branches->ids()
            : $this->users->branchIds((int) $user->id);
        $currentBranchId = $branchIds[0] ?? null;
        Session::set('branch_ids', $branchIds);
        Session::set('current_branch_id', $currentBranchId);
        Session::set('_csrf', bin2hex(random_bytes(32)));

        if ($remember) {
            $this->rememberMe->issue($user, $currentBranchId, $request);
        } else {
            $this->rememberMe->clearCurrentCookie();
        }

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
            'idle_timeout_minutes' => max(5, (int) Config::get('auth.session.idle_minutes', 30)),
            'remembered' => (bool) Session::get('remembered', false),
            'remember_days' => $this->rememberMe->days(),
            'google_login_enabled' => $this->googleLoginEnabled(),
            'csrf_token' => Session::csrfToken(),
        ];
    }

    public function selectBranch(int $branchId): array
    {
        $authz = new AuthorizationService();
        $authz->assertBranch($branchId);
        Session::set('current_branch_id', $branchId);
        $this->rememberMe->syncBranch($branchId);
        $this->logs->record('select_branch', 'auth', 'branch', $branchId, 'Chọn cơ sở làm việc');
        return ['current_branch_id' => $branchId];
    }

    public function logout(): void
    {
        $userId = (int) Session::get('user_id', 0);
        if ($userId > 0) {
            $this->logs->record('logout', 'auth', 'user', $userId, 'Đăng xuất');
        }
        $this->rememberMe->clearCurrentCookie();
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
        PasswordPolicy::assertValid($newPassword);
        $hash = password_hash($newPassword, PASSWORD_DEFAULT);
        $this->users->setPassword($userId, $hash);
        Session::set('password_fingerprint', hash('sha256', $hash));
        $this->rememberMe->revokeAllForUser($userId);
        if ((bool) Session::get('remembered', false)) {
            $user->password_hash = $hash;
            $branchId = Session::get('current_branch_id');
            $this->rememberMe->issue($user, $branchId !== null ? (int) $branchId : null);
        }
        $this->logs->record('change_password', 'staff', 'user', $userId, 'Đổi mật khẩu cá nhân');
    }

    public function updateProfile(int $userId, string $fullName, ?string $phone): array
    {
        $this->users->update($userId, ['full_name' => $fullName, 'phone' => $phone]);
        $this->logs->record('update_profile', 'staff', 'user', $userId, 'Cập nhật thông tin cá nhân');
        return $this->payload();
    }
}
