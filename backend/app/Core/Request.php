<?php
declare(strict_types=1);

namespace App\Core;

final class Request
{
    private static ?self $current = null;

    private array $routeParams = [];
    private array $attributes = [];
    private ?array $bodyCache = null;

    public function __construct(
        private string $method,
        private string $path,
        private array $query,
    ) {
    }

    public static function capture(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uri = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');

        $bases = [];
        $scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
        if ($scriptDir !== '' && $scriptDir !== '/' && $scriptDir !== '.') {
            $bases[] = rtrim($scriptDir, '/');
        }
        $appUrlPath = (string) (parse_url((string) Env::get('APP_URL', ''), PHP_URL_PATH) ?: '');
        if ($appUrlPath !== '' && $appUrlPath !== '/') {
            $bases[] = rtrim($appUrlPath, '/');
        }

        $path = $uri;
        foreach (array_unique($bases) as $base) {
            if (str_starts_with($path, $base)) {
                $path = substr($path, strlen($base)) ?: '/';
                break;
            }
        }
        $path = '/' . trim($path, '/');
        if ($path === '//' || $path === '/index.php') {
            $path = '/';
        }

        $request = new self($method, $path, $_GET);
        self::$current = $request;
        return $request;
    }

    public static function setCurrent(self $request): void
    {
        self::$current = $request;
    }

    public static function current(): ?self
    {
        return self::$current;
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        return $this->path;
    }

    public function query(): array
    {
        return $this->query;
    }

    public function body(): array
    {
        if ($this->bodyCache !== null) {
            return $this->bodyCache;
        }
        $contentType = (string) ($_SERVER['CONTENT_TYPE'] ?? '');
        $raw = file_get_contents('php://input');
        $body = [];
        if (str_contains(strtolower($contentType), 'application/json')) {
            $decoded = json_decode($raw !== false ? $raw : '', true);
            $body = is_array($decoded) ? $decoded : [];
        } elseif ($this->method === 'POST') {
            $body = $_POST;
        } elseif ($raw !== false && $raw !== '') {
            parse_str($raw, $body);
        }
        return $this->bodyCache = $body;
    }

    public function all(): array
    {
        return array_merge($this->query, $this->body());
    }

    public function input(string $key, mixed $default = null): mixed
    {
        $body = $this->body();
        if (array_key_exists($key, $body)) {
            return $body[$key];
        }
        return $this->query[$key] ?? $default;
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->body()) || array_key_exists($key, $this->query);
    }

    public function file(string $key): ?array
    {
        $file = $_FILES[$key] ?? null;
        return is_array($file) ? $file : null;
    }

    public function header(string $name): ?string
    {
        $key = strtoupper(str_replace('-', '_', $name));
        $value = $_SERVER['HTTP_' . $key] ?? null;
        if ($value === null && $key === 'CONTENT_TYPE') {
            $value = $_SERVER['CONTENT_TYPE'] ?? null;
        }
        return $value !== null ? (string) $value : null;
    }

    public function wantsJson(): bool
    {
        if (str_starts_with($this->path, '/api')) {
            return true;
        }
        if (stripos($this->header('Accept') ?? '', 'application/json') !== false) {
            return true;
        }
        return $this->header('X-Requested-With') === 'XMLHttpRequest';
    }

    public function ip(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    }

    public function userAgent(): string
    {
        return mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
    }

    public function setRouteParams(array $params): void
    {
        $this->routeParams = $params;
    }

    public function routeParams(): array
    {
        return $this->routeParams;
    }

    public function routeParam(string $name, mixed $default = null): mixed
    {
        return $this->routeParams[$name] ?? $default;
    }

    public function setAttribute(string $key, mixed $value): void
    {
        $this->attributes[$key] = $value;
    }

    public function getAttribute(string $key, mixed $default = null): mixed
    {
        return $this->attributes[$key] ?? $default;
    }
}
