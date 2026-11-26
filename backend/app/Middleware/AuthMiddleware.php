<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Exceptions\HttpException;
use App\Repositories\UserRepository;

final class AuthMiddleware
{
    public function handle(Request $request, \Closure $next): void
    {
        $userId = (int) Session::get('user_id', 0);
        if ($userId <= 0) {
            $this->reject($request, 'Vui lòng đăng nhập để tiếp tục');
        }
        $user = (new UserRepository())->findWithRole($userId);
        if ($user === null || (string) $user->status !== 'active') {
            Session::destroy();
            $this->reject($request, 'Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khoá');
        }
        $fingerprint = Session::get('password_fingerprint');
        $expected = hash('sha256', (string) $user->password_hash);
        if (!is_string($fingerprint) || $fingerprint === '' || !hash_equals($expected, $fingerprint)) {
            Session::destroy();
            $this->reject($request, 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại');
        }
        Session::set('role_key', (string) $user->role_key);
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
