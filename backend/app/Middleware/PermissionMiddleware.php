<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Services\AuthorizationService;

final class PermissionMiddleware
{
    public function __construct(private string $permission)
    {
    }

    public function handle(Request $request, \Closure $next): void
    {
        (new AuthorizationService())->ensure($this->permission);
        $next();
    }
}
