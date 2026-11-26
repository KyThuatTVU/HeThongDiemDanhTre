<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Session;
use App\Services\AuthorizationService;

final class BranchScopeMiddleware
{
    public function handle(Request $request, \Closure $next): void
    {
        $branchIds = (new AuthorizationService())->currentUserBranchIds();
        $request->setAttribute('allowed_branch_ids', $branchIds);

        $current = (int) Session::get('current_branch_id', 0);
        if ($branchIds !== [] && !in_array($current, $branchIds, true)) {
            Session::set('current_branch_id', (int) $branchIds[0]);
            Session::set('branch_ids', $branchIds);
        }
        $next();
    }
}
