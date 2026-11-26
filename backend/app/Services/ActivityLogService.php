<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\Request;
use App\Core\Session;
use App\Repositories\ActivityLogRepository;

final class ActivityLogService
{
    private ActivityLogRepository $repository;

    public function __construct()
    {
        $this->repository = new ActivityLogRepository();
    }

    public function record(
        string $action,
        string $module,
        ?string $targetType = null,
        ?int $targetId = null,
        ?string $description = null,
        ?array $oldValues = null,
        ?array $newValues = null
    ): void {
        $request = Request::current();
        $oldValues = $this->redactSensitiveValues($oldValues);
        $newValues = $this->redactSensitiveValues($newValues);
        $this->repository->create([
            'user_id' => Session::get('user_id') ?: null,
            'action' => $action,
            'module' => $module,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'description' => $description !== null ? mb_substr($description, 0, 255) : null,
            'old_values' => $oldValues === null ? null : json_encode($oldValues, JSON_UNESCAPED_UNICODE),
            'new_values' => $newValues === null ? null : json_encode($newValues, JSON_UNESCAPED_UNICODE),
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
        ]);
    }

    public function recordLogin(?int $userId, ?string $identifier, string $method, string $status): void
    {
        $request = Request::current();
        $this->repository->createLogin([
            'user_id' => $userId,
            'attempted_identifier' => $identifier !== null ? mb_substr($identifier, 0, 150) : null,
            'login_method' => $method,
            'status' => $status,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
        ]);
    }

    public function activityList(array $filters, int $page, int $perPage): array
    {
        return $this->repository->paginate($this->applyViewerScope($filters), $page, $perPage);
    }

    public function loginList(array $filters, int $page, int $perPage): array
    {
        return $this->repository->loginHistory($this->applyViewerScope($filters), $page, $perPage);
    }

    private function applyViewerScope(array $filters): array
    {
        $authz = new AuthorizationService();
        if (!$authz->isSuperAdmin()) {
            $filters['scope_branch_ids'] = $authz->currentUserBranchIds();
        }
        return $filters;
    }

    private function redactSensitiveValues(?array $values): ?array
    {
        if ($values === null) {
            return null;
        }
        foreach ($values as $key => $value) {
            if (is_string($key) && preg_match('/password|token|secret|hash/i', $key)) {
                $values[$key] = '[redacted]';
                continue;
            }
            if (is_array($value)) {
                $values[$key] = $this->redactSensitiveValues($value);
            }
        }
        return $values;
    }
}
