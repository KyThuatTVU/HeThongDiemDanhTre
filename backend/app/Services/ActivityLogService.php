<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\Env;
use App\Core\Request;
use App\Core\Session;
use App\Repositories\ActivityLogRepository;

final class ActivityLogService
{
    private const PRUNE_MARKER_FILE = '/storage/cache/last_db_log_prune.txt';
    private const PRUNE_INTERVAL_SEC = 86400; // Tối đa 1 lần/ngày

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
        $this->maybeAutoPrune();
    }

    public function pruneOldLogs(?int $keepDays = null, int $batchLimit = 2000): array
    {
        $days = max(7, $keepDays ?? Env::int('DB_LOG_KEEP_DAYS', 90));
        return $this->repository->pruneOldLogs($days, $batchLimit);
    }

    private function maybeAutoPrune(): void
    {
        $marker = BASE_PATH . self::PRUNE_MARKER_FILE;
        $lastRun = is_file($marker) ? (int) @filemtime($marker) : 0;
        if ($lastRun > 0 && (time() - $lastRun) < self::PRUNE_INTERVAL_SEC) {
            return;
        }
        $dir = dirname($marker);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        @file_put_contents($marker, (string) time(), LOCK_EX);
        try {
            $this->pruneOldLogs(null, 500);
        } catch (\Throwable) {
            // Không làm gián đoạn thao tác chính nếu dọn log nền lỗi
        }
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
        $this->maybeAutoPrune();
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
