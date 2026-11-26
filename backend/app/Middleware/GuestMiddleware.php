<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;
use App\Core\Session;

final class GuestMiddleware
{
    public function handle(Request $request, \Closure $next): void
    {
        if ((int) Session::get('user_id', 0) > 0) {
            if ($request->wantsJson()) {
                Response::json(['message' => 'Bạn đã đăng nhập'], 409);
            }
            Response::redirect(url('/'));
        }
        $next();
    }
}
