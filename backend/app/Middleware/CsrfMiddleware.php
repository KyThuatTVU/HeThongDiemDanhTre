<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Session;
use App\Exceptions\HttpException;

final class CsrfMiddleware
{
    public function handle(Request $request, \Closure $next): void
    {
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            $next();
            return;
        }
        $token = $request->header('X-CSRF-Token') ?? (string) $request->input('_token', '');
        if (!Session::validateCsrf($token)) {
            throw new HttpException(419, 'CSRF token không hợp lệ hoặc đã hết hạn. Vui lòng tải lại trang.');
        }
        $next();
    }
}
