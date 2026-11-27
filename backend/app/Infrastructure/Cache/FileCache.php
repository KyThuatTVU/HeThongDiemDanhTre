<?php
declare(strict_types=1);

namespace App\Infrastructure\Cache;

use App\Core\Config;

final class FileCache
{
    public static function get(string $key, mixed $default = null): mixed
    {
        [$found, $value] = self::read($key);
        return $found ? $value : $default;
    }

    public static function put(string $key, mixed $value, int $ttl): bool
    {
        if (!self::enabled() || $ttl <= 0) {
            return false;
        }
        $file = self::file($key);
        $directory = dirname($file);
        if (!is_dir($directory) && !@mkdir($directory, 0775, true) && !is_dir($directory)) {
            return false;
        }
        $payload = json_encode(
            ['expires_at' => time() + $ttl, 'value' => $value],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        if ($payload === false) {
            return false;
        }
        $temporary = @tempnam($directory, 'cache');
        if ($temporary === false) {
            return false;
        }
        if (@file_put_contents($temporary, $payload, LOCK_EX) === false) {
            @unlink($temporary);
            return false;
        }
        @chmod($temporary, 0664);
        if (!@rename($temporary, $file)) {
            @unlink($temporary);
            return false;
        }
        self::maybeGc();
        return true;
    }

    public static function remember(string $key, int $ttl, callable $resolver): mixed
    {
        [$found, $value] = self::read($key);
        if ($found) {
            return $value;
        }
        $value = $resolver();
        self::put($key, $value, $ttl);
        return $value;
    }

    public static function forget(string|array $keys): void
    {
        foreach ((array) $keys as $key) {
            $file = self::file((string) $key);
            if (is_file($file)) {
                @unlink($file);
            }
        }
    }

    public static function flush(): int
    {
        $removed = 0;
        $patterns = [
            self::directory() . '/*.json',
            self::directory() . '/*/*.json',
        ];
        foreach ($patterns as $pattern) {
            foreach (glob($pattern) ?: [] as $file) {
                if (is_file($file) && @unlink($file)) {
                    $removed++;
                }
            }
        }
        // Dọn thư mục con rỗng cũ để tiết kiệm inode trên host miễn phí
        foreach (glob(self::directory() . '/*', GLOB_ONLYDIR) ?: [] as $subdir) {
            @rmdir($subdir);
        }
        return $removed;
    }

    public static function gc(): int
    {
        $now = time();
        $staleDeadline = $now - 3600; // TTL tối đa của cache là 10 phút
        $removed = 0;
        $files = array_merge(
            glob(self::directory() . '/*.json') ?: [],
            glob(self::directory() . '/*/*.json') ?: []
        );
        foreach (array_slice($files, 0, 200) as $file) {
            if (!is_file($file)) {
                continue;
            }
            $modified = @filemtime($file);
            if ($modified !== false && $modified < $staleDeadline) {
                if (@unlink($file)) {
                    $removed++;
                }
                continue;
            }
            $raw = @file_get_contents($file);
            if ($raw === false) {
                continue;
            }
            $payload = json_decode($raw, true);
            if (!is_array($payload) || (int) ($payload['expires_at'] ?? 0) < $now) {
                if (@unlink($file)) {
                    $removed++;
                }
            }
        }
        foreach (glob(self::directory() . '/*', GLOB_ONLYDIR) ?: [] as $subdir) {
            @rmdir($subdir);
        }
        return $removed;
    }

    private static function read(string $key): array
    {
        if (!self::enabled()) {
            return [false, null];
        }
        $file = self::file($key);
        if (!is_file($file)) {
            return [false, null];
        }
        $raw = @file_get_contents($file);
        if ($raw === false) {
            return [false, null];
        }
        $payload = json_decode($raw, true);
        if (!is_array($payload) || !isset($payload['expires_at']) || !array_key_exists('value', $payload)) {
            @unlink($file);
            return [false, null];
        }
        if ((int) $payload['expires_at'] < time()) {
            @unlink($file);
            return [false, null];
        }
        return [true, $payload['value']];
    }

    private static function file(string $key): string
    {
        // Lưu phẳng trong 1 thư mục (không tạo 256 thư mục con) để tiết kiệm inode trên host miễn phí
        $hash = hash('sha256', $key);
        return self::directory() . '/' . $hash . '.json';
    }

    private static function directory(): string
    {
        $path = str_replace('\\', '/', (string) Config::get('cache.path', 'storage/cache/data'));
        if (!str_starts_with($path, '/') && !preg_match('#^[A-Za-z]:/#', $path)) {
            $path = BASE_PATH . '/' . ltrim($path, '/');
        }
        return rtrim($path, '/');
    }

    private static function enabled(): bool
    {
        return (bool) Config::get('cache.enabled', true);
    }

    private static function maybeGc(): void
    {
        try {
            if (random_int(1, 30) !== 1) {
                return;
            }
        } catch (\Throwable) {
            return;
        }
        self::gc();
    }
}
