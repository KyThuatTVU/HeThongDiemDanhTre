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
        foreach (glob(self::directory() . '/*/*.json') ?: [] as $file) {
            if (is_file($file) && @unlink($file)) {
                $removed++;
            }
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
        $hash = hash('sha256', $key);
        return self::directory() . '/' . substr($hash, 0, 2) . '/' . $hash . '.json';
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
        if (random_int(1, 100) !== 1) {
            return;
        }
        $deadline = time() - 172800;
        $files = glob(self::directory() . '/*/*.json') ?: [];
        foreach (array_slice($files, 0, 200) as $file) {
            $modified = @filemtime($file);
            if ($modified !== false && $modified < $deadline) {
                @unlink($file);
            }
        }
    }
}
