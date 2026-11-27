<?php
declare(strict_types=1);

namespace App\Core;

final class Session
{
    public static function start(array $config): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        $savePath = BASE_PATH . '/storage/sessions';
        if (is_dir($savePath) && is_writable($savePath)) {
            session_save_path($savePath);
        }
        $lifetimeSec = max(5, (int) ($config['lifetime'] ?? 120)) * 60;
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.gc_maxlifetime', (string) $lifetimeSec);
        session_name((string) ($config['name'] ?? 'app_session'));
        session_set_cookie_params([
            'lifetime' => $lifetimeSec,
            'path' => '/',
            'domain' => '',
            'secure' => (bool) ($config['secure'] ?? false),
            'httponly' => (bool) ($config['http_only'] ?? true),
            'samesite' => (string) ($config['same_site'] ?? 'Lax'),
        ]);
        session_start();
        if (is_dir($savePath)) {
            self::maybeGc($savePath, $lifetimeSec);
        }
    }

    public static function touchCookie(array $config): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE || headers_sent()) {
            return;
        }
        $lifetimeSec = max(5, (int) ($config['lifetime'] ?? 120)) * 60;
        setcookie(session_name(), session_id(), [
            'expires' => time() + $lifetimeSec,
            'path' => '/',
            'domain' => '',
            'secure' => (bool) ($config['secure'] ?? false),
            'httponly' => (bool) ($config['http_only'] ?? true),
            'samesite' => (string) ($config['same_site'] ?? 'Lax'),
        ]);
    }

    public static function gc(int $maxLifetimeSec = 7200): int
    {
        $savePath = BASE_PATH . '/storage/sessions';
        if (!is_dir($savePath)) {
            return 0;
        }
        $deadline = time() - max(1800, $maxLifetimeSec);
        $removed = 0;
        $files = glob(rtrim($savePath, '/\\') . '/sess_*') ?: [];
        foreach (array_slice($files, 0, 200) as $file) {
            if (!is_file($file)) {
                continue;
            }
            $modified = @filemtime($file);
            if ($modified !== false && $modified < $deadline && @unlink($file)) {
                $removed++;
            }
        }
        return $removed;
    }

    private static function maybeGc(string $savePath, int $maxLifetimeSec): void
    {
        try {
            if (random_int(1, 40) !== 1) {
                return;
            }
        } catch (\Throwable) {
            return;
        }
        self::gc($maxLifetimeSec);
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public static function has(string $key): bool
    {
        return array_key_exists($key, $_SESSION);
    }

    public static function forget(string $key): void
    {
        unset($_SESSION[$key]);
    }

    public static function regenerate(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }
    }

    public static function release(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
    }

    public static function destroy(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
            session_destroy();
        }
    }

    public static function csrfToken(): string
    {
        $token = $_SESSION['_csrf'] ?? null;
        if (!is_string($token) || $token === '') {
            $token = bin2hex(random_bytes(32));
            $_SESSION['_csrf'] = $token;
        }
        return $token;
    }

    public static function validateCsrf(?string $token): bool
    {
        $stored = $_SESSION['_csrf'] ?? null;
        return is_string($stored) && is_string($token) && $token !== '' && hash_equals($stored, $token);
    }
}
