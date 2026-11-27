<?php
declare(strict_types=1);

namespace App\Core;

final class Env
{
    private static array $values = [];

    public static function load(string $path): void
    {
        self::$values = [];
        self::loadOverlay($path);
    }

    public static function loadOverlay(string $path): void
    {
        if (!is_file($path)) {
            return;
        }
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            $pos = strpos($line, '=');
            if ($pos === false) {
                continue;
            }
            $key = trim(substr($line, 0, $pos));
            $value = trim(substr($line, $pos + 1));
            if ($value !== '' && (($value[0] === '"' && str_ends_with($value, '"')) || ($value[0] === "'" && str_ends_with($value, "'")))) {
                $value = substr($value, 1, -1);
            }
            self::$values[$key] = $value;
        }
    }

    public static function isLocalHost(): bool
    {
        if (PHP_SAPI === 'cli') {
            return true;
        }
        $hostHeader = strtolower(trim((string) ($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '')));
        if ($hostHeader === '') {
            return true;
        }
        // Lấy tên host bỏ port (hỗ trợ cả IPv6 [::1])
        $host = str_starts_with($hostHeader, '[')
            ? substr($hostHeader, 1, (int) strpos($hostHeader, ']') - 1)
            : explode(':', $hostHeader)[0];

        return in_array($host, ['localhost', '127.0.0.1', '::1'], true)
            || str_ends_with($host, '.local')
            || str_ends_with($host, '.test');
    }

    public static function isHttpsRequest(): bool
    {
        $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
        if ($https !== '' && $https !== 'off' && $https !== '0') {
            return true;
        }
        if ((string) ($_SERVER['SERVER_PORT'] ?? '') === '443') {
            return true;
        }
        $forwarded = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
        if ($forwarded !== '' && str_contains($forwarded, 'https')) {
            return true;
        }
        return false;
    }

    public static function detectedBaseUrl(): string
    {
        if (PHP_SAPI === 'cli') {
            return '';
        }
        $host = trim((string) ($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? ''));
        if ($host === '' || !preg_match('/^[a-z0-9.\-:\[\]]+$/i', $host)) {
            return '';
        }
        $scheme = self::isHttpsRequest() ? 'https' : 'http';
        $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
        $basePath = (string) preg_replace('#/(?:backend/public/index\.php|backend/public|router\.php|index\.php)$#i', '', $script);
        $basePath = rtrim($basePath, '/');
        return $scheme . '://' . $host . $basePath;
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        return self::$values[$key] ?? $default;
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $value = self::get($key);
        if ($value === null || $value === '') {
            return $default;
        }
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    public static function int(string $key, int $default = 0): int
    {
        $value = self::get($key);
        return $value === null || $value === '' ? $default : (int) $value;
    }
}
