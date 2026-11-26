<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Services\DashboardService;

final class DashboardController extends Controller
{
    public function summary(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $this->ok((new DashboardService())->summary($branchId));
    }
}
