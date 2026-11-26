<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Session;
use App\Exceptions\HttpException;

final class RoleMiddleware
{
    public function __construct(private string $roleKey)
    {
    }

    public function handle(Request $request, \Closure $next): void
    {
        if ((string) Session::get('role_key', '') !== $this->roleKey) {
            throw new HttpException(403, 'Bạn không có quyền truy cập chức năng này');
        }
        $next();
    }
}
