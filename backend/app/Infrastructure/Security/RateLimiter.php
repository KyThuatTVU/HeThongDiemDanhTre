<?php
declare(strict_types=1);

namespace App\Infrastructure\Security;

use App\Core\Config;

final class RateLimiter
{
    /**
     * Ghi nhận một lần thử và trả về số giây phải chờ (0 = được phép tiếp tục).
     */
    public static function hit(string $bucket, string $scope, string $value, array $rule): int
    {
        $max = (int) ($rule['max'] ?? 0);
        $window = (int) ($rule['window'] ?? 60);
        $block = (int) ($rule['block'] ?? $window);
        if ($max <= 0 || $window <= 0) {
            return 0;
        }

        $file = self::file($bucket, $scope, $value);
        $directory = dirname($file);
        if (!is_dir($directory) && !@mkdir($directory, 0775, true) && !is_dir($directory)) {
            return 0;
        }
        $handle = @fopen($file, 'c+');
        if ($handle === false) {
            return 0;
        }

        try {
            if (!flock($handle, LOCK_EX)) {
                return 0;
            }
            $now = time();
            $raw = stream_get_contents($handle);
            $state = json_decode($raw !== false && $raw !== '' ? $raw : '', true);
            if (!is_array($state)) {
                $state = [];
            }
            $blockedUntil = (int) ($state['blocked_until'] ?? 0);
            if ($blockedUntil > $now) {
                return $blockedUntil - $now;
            }

            $resetAt = (int) ($state['reset_at'] ?? 0);
            if ($resetAt <= $now) {
                $resetAt = $now + $window;
                $count = 0;
            } else {
                $count = (int) ($state['count'] ?? 0);
            }
            $count++;
            if ($count > $max) {
                $blockedUntil = $now + $block;
            }

            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, (string) json_encode([
                'count' => $count,
                'reset_at' => $resetAt,
                'blocked_until' => $blockedUntil,
            ]));
            fflush($handle);

            return max(0, $blockedUntil - $now);
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
            self::maybeGc();
        }
    }

    public static function clear(string $bucket, string $scope, string $value): void
    {
        $file = self::file($bucket, $scope, $value);
        if (is_file($file)) {
            @unlink($file);
        }
    }

    private static function file(string $bucket, string $scope, string $value): string
    {
        $identity = $bucket . '|' . $scope . '|' . mb_strtolower(trim($value));
        return self::directory() . '/' . hash('sha256', $identity) . '.json';
    }

    private static function directory(): string
    {
        $path = str_replace('\\', '/', (string) Config::get('security.rate_limit_storage', 'storage/cache/ratelimit'));
        if (!str_starts_with($path, '/') && !preg_match('#^[A-Za-z]:/#', $path)) {
            $path = BASE_PATH . '/' . ltrim($path, '/');
        }
        return rtrim($path, '/');
    }

    private static function maybeGc(): void
    {
        if (random_int(1, 100) !== 1) {
            return;
        }
        $deadline = time() - 172800;
        foreach (glob(self::directory() . '/*.json') ?: [] as $file) {
            $modified = @filemtime($file);
            if ($modified !== false && $modified < $deadline) {
                @unlink($file);
            }
        }
    }
}
