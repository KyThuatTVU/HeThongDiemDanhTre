<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\Request;
use App\Core\Session;
use App\Models\User;
use App\Repositories\BranchRepository;
use App\Repositories\RememberTokenRepository;
use App\Repositories\UserRepository;

final class RememberMeService
{
    // Chỉ xoay vòng validator nếu lần dùng trước cách ít nhất 5 phút để tránh xung đột khi nhiều tab mở cùng lúc
    private const ROTATE_COOLDOWN_SECONDS = 300;

    private RememberTokenRepository $tokens;
    private UserRepository $users;
    private BranchRepository $branches;

    public function __construct()
    {
        $this->tokens = new RememberTokenRepository();
        $this->users = new UserRepository();
        $this->branches = new BranchRepository();
    }

    public function cookieName(): string
    {
        $name = trim((string) Config::get('auth.remember.cookie_name', 'happykidsck_remember'));
        return $name !== '' ? $name : 'happykidsck_remember';
    }

    public function days(): int
    {
        return max(1, min(90, (int) Config::get('auth.remember.days', 30)));
    }

    public function hasCookie(): bool
    {
        return $this->parseCookie() !== null;
    }

    public function issue(User $user, ?int $branchId, ?Request $request = null): void
    {
        // Xoá token cũ trên cùng trình duyệt (nếu có) để tránh rác
        $existing = $this->parseCookie();
        if ($existing !== null) {
            $this->tokens->deleteBySelector($existing['selector']);
        }

        $selector = bin2hex(random_bytes(16));
        $validator = bin2hex(random_bytes(32));
        $expiresTs = time() + ($this->days() * 86400);

        $inserted = $this->tokens->create([
            'user_id' => (int) $user->id,
            'selector' => $selector,
            'token_hash' => hash('sha256', $validator),
            'password_fingerprint' => hash('sha256', (string) $user->password_hash),
            'branch_id' => $branchId,
            'ip_address' => $request !== null ? mb_substr($request->ip(), 0, 45) : null,
            'user_agent' => $request !== null ? mb_substr($request->userAgent(), 0, 255) : null,
            'last_used_at' => date('Y-m-d H:i:s'),
            'expires_at' => date('Y-m-d H:i:s', $expiresTs),
        ]);

        if ($inserted <= 0) {
            return;
        }

        $maxDevices = max(1, min(30, (int) Config::get('auth.remember.max_devices_per_user', 10)));
        $this->tokens->pruneUserExcess((int) $user->id, $maxDevices);
        $this->maybePruneExpired();
        $this->sendCookie($selector . '.' . $validator, $expiresTs);
    }

    public function restoreFromCookie(?Request $request = null): ?User
    {
        $parsed = $this->parseCookie();
        if ($parsed === null) {
            return null;
        }

        $row = $this->tokens->findBySelector($parsed['selector']);
        if ($row === null) {
            $this->expireCookie();
            return null;
        }

        $expiresTs = strtotime((string) $row['expires_at']);
        if ($expiresTs === false || $expiresTs <= time()) {
            $this->tokens->deleteById((int) $row['id']);
            $this->expireCookie();
            return null;
        }

        $expectedHash = (string) $row['token_hash'];
        $actualHash = hash('sha256', $parsed['validator']);
        if ($expectedHash === '' || !hash_equals($expectedHash, $actualHash)) {
            $this->tokens->deleteById((int) $row['id']);
            $this->expireCookie();
            return null;
        }

        $user = $this->users->findWithRole((int) $row['user_id']);
        if ($user === null || (string) $user->status !== 'active') {
            $this->tokens->deleteById((int) $row['id']);
            $this->expireCookie();
            return null;
        }

        $passwordFingerprint = hash('sha256', (string) $user->password_hash);
        if (!hash_equals($passwordFingerprint, (string) $row['password_fingerprint'])) {
            $this->tokens->deleteAllForUser((int) $user->id);
            $this->expireCookie();
            return null;
        }

        // Khôi phục session PHP sạch sẽ
        $sessionConfig = (array) Config::get('auth.session', []);
        Session::regenerate();
        Session::set('user_id', (int) $user->id);
        Session::set('role_key', (string) $user->role_key);
        Session::set('password_fingerprint', $passwordFingerprint);
        Session::set('last_activity', time());
        Session::set('remembered', true);

        $branchIds = (string) $user->role_key === 'super_admin'
            ? $this->branches->ids()
            : $this->users->branchIds((int) $user->id);
        $savedBranchId = isset($row['branch_id']) && $row['branch_id'] !== null ? (int) $row['branch_id'] : null;
        $currentBranchId = ($savedBranchId !== null && in_array($savedBranchId, $branchIds, true))
            ? $savedBranchId
            : ($branchIds[0] ?? null);
        Session::set('branch_ids', $branchIds);
        Session::set('current_branch_id', $currentBranchId);
        Session::csrfToken();
        Session::touchCookie($sessionConfig);

        // Xoay vòng validator và gia hạn thêm 30 ngày nếu đã qua thời gian chờ an toàn
        $lastUsedTs = strtotime((string) $row['last_used_at']) ?: 0;
        if ((time() - $lastUsedTs) >= self::ROTATE_COOLDOWN_SECONDS) {
            $newValidator = bin2hex(random_bytes(32));
            $newExpiresTs = time() + ($this->days() * 86400);
            $this->tokens->touch(
                (int) $row['id'],
                date('Y-m-d H:i:s', $newExpiresTs),
                hash('sha256', $newValidator),
                $request !== null ? mb_substr($request->ip(), 0, 45) : null,
                $request !== null ? mb_substr($request->userAgent(), 0, 255) : null
            );
            $this->sendCookie($parsed['selector'] . '.' . $newValidator, $newExpiresTs);
        }

        $this->maybePruneExpired();
        return $user;
    }

    public function syncBranch(?int $branchId): void
    {
        $parsed = $this->parseCookie();
        if ($parsed === null) {
            return;
        }
        $this->tokens->updateBranchBySelector($parsed['selector'], $branchId);
    }

    public function clearCurrentCookie(): void
    {
        $parsed = $this->parseCookie();
        if ($parsed !== null) {
            $this->tokens->deleteBySelector($parsed['selector']);
        }
        $this->expireCookie();
    }

    public function revokeAllForUser(int $userId): void
    {
        $this->tokens->deleteAllForUser($userId);
    }

    /** @return array{selector: string, validator: string}|null */
    private function parseCookie(): ?array
    {
        $raw = $_COOKIE[$this->cookieName()] ?? '';
        if (!is_string($raw) || $raw === '' || !str_contains($raw, '.')) {
            return null;
        }
        $parts = explode('.', $raw, 2);
        if (count($parts) !== 2) {
            return null;
        }
        [$selector, $validator] = $parts;
        if (!preg_match('/^[a-f0-9]{16,64}$/', $selector) || !preg_match('/^[a-f0-9]{32,128}$/', $validator)) {
            return null;
        }
        return ['selector' => $selector, 'validator' => $validator];
    }

    private function sendCookie(string $value, int $expiresTs): void
    {
        $_COOKIE[$this->cookieName()] = $value;
        if (headers_sent()) {
            return;
        }
        $sessionConfig = (array) Config::get('auth.session', []);
        setcookie($this->cookieName(), $value, [
            'expires' => $expiresTs,
            'path' => '/',
            'domain' => '',
            'secure' => (bool) ($sessionConfig['secure'] ?? false),
            'httponly' => true,
            'samesite' => (string) ($sessionConfig['same_site'] ?? 'Lax'),
        ]);
    }

    private function expireCookie(): void
    {
        unset($_COOKIE[$this->cookieName()]);
        if (headers_sent()) {
            return;
        }
        $sessionConfig = (array) Config::get('auth.session', []);
        setcookie($this->cookieName(), '', [
            'expires' => time() - 42000,
            'path' => '/',
            'domain' => '',
            'secure' => (bool) ($sessionConfig['secure'] ?? false),
            'httponly' => true,
            'samesite' => (string) ($sessionConfig['same_site'] ?? 'Lax'),
        ]);
    }

    private function maybePruneExpired(): void
    {
        try {
            if (random_int(1, 50) !== 1) {
                return;
            }
        } catch (\Throwable) {
            return;
        }
        $this->tokens->deleteExpired();
    }
}
