<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\Config;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Exceptions\HttpException;
use App\Infrastructure\Logging\Logger;
use App\Infrastructure\Security\RateLimiter;

final class RateLimitMiddleware
{
    public function __construct(private string $bucket)
    {
    }

    public function handle(Request $request, \Closure $next): void
    {
        $bucketConfig = Config::get('security.rate_limit.' . $this->bucket);
        if (!is_array($bucketConfig)) {
            throw new HttpException(500, 'Cấu hình giới hạn truy cập không tồn tại: ' . $this->bucket);
        }

        $field = isset($bucketConfig['field']) ? (string) $bucketConfig['field'] : '';
        $identifier = $field !== '' ? trim((string) $request->input($field, '')) : '';

        foreach ((array) ($bucketConfig['scopes'] ?? []) as $scope => $rule) {
            if (!is_array($rule)) {
                continue;
            }
            $value = match ((string) $scope) {
                'account' => $identifier !== '' ? $identifier : $request->ip(),
                'user' => (string) (Session::get('user_id') ?: $request->ip()),
                default => $request->ip() !== '' ? $request->ip() : 'unknown',
            };
            $retryAfter = RateLimiter::hit($this->bucket, (string) $scope, $value, $rule);
            if ($retryAfter <= 0) {
                continue;
            }
            Logger::warning('Rate limit exceeded', [
                'bucket' => $this->bucket,
                'scope' => (string) $scope,
                'path' => $request->path(),
                'ip' => $request->ip(),
            ]);
            header('Retry-After: ' . $retryAfter);
            $wait = $retryAfter >= 120 ? (int) ceil($retryAfter / 60) . ' phút' : $retryAfter . ' giây';
            Response::json([
                'message' => 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ' . $wait . '.',
                'retry_after' => $retryAfter,
            ], 429);
        }

        $next();
    }
}
