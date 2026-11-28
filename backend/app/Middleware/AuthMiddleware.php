<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\Config;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Repositories\UserRepository;
use App\Services\RememberMeService;

final class AuthMiddleware
{
    public function handle(Request $request, \Closure $next): void
    {
        $userId = (int) Session::get('user_id', 0);
        if ($userId <= 0) {
            $restored = (new RememberMeService())->restoreFromCookie($request);
            if ($restored !== null) {
                $request->setAttribute('user', $restored);
                $next();
                return;
            }
            $this->reject($request, 'Vui lòng đăng nhập để tiếp tục');
        }

        $sessionConfig = (array) Config::get('auth.session', []);
        $idleMinutes = max(5, (int) ($sessionConfig['idle_minutes'] ?? 30));
        $now = time();
        $lastActivity = (int) Session::get('last_activity', 0);
        if ($lastActivity > 0 && ($now - $lastActivity) > ($idleMinutes * 60)) {
            if ((bool) Session::get('remembered', false)) {
                $restored = (new RememberMeService())->restoreFromCookie($request);
                if ($restored !== null) {
                    $request->setAttribute('user', $restored);
                    $next();
                    return;
                }
            }
            Session::destroy();
            $this->reject($request, 'Phiên làm việc đã tự đóng sau ' . $idleMinutes . ' phút không thao tác. Vui lòng đăng nhập lại');
        }

        $user = (new UserRepository())->findWithRole($userId);
        if ($user === null || (string) $user->status !== 'active') {
            (new RememberMeService())->clearCurrentCookie();
            Session::destroy();
            $this->reject($request, 'Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khoá');
        }
        $fingerprint = Session::get('password_fingerprint');
        $expected = hash('sha256', (string) $user->password_hash);
        if (!is_string($fingerprint) || $fingerprint === '' || !hash_equals($expected, $fingerprint)) {
            (new RememberMeService())->clearCurrentCookie();
            Session::destroy();
            $this->reject($request, 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại');
        }

        // Gia hạn mốc hoạt động (cập nhật cookie mỗi 5 phút để không gửi Set-Cookie dư thừa)
        if ($lastActivity === 0 || ($now - $lastActivity) >= 300) {
            Session::touchCookie($sessionConfig);
        }
        Session::set('last_activity', $now);
        Session::set('role_key', (string) $user->role_key);
        Session::csrfToken();
        $request->setAttribute('user', $user);
        $next();
    }

    private function reject(Request $request, string $message): never
    {
        if ($request->wantsJson()) {
            Response::json(['message' => $message], 401);
        }
        Response::redirect(url('/'));
    }
}
