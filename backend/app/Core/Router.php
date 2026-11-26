<?php
declare(strict_types=1);

namespace App\Core;

use App\Exceptions\HttpException;
use App\Middleware\AuthMiddleware;
use App\Middleware\BranchScopeMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Middleware\GuestMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Middleware\RateLimitMiddleware;
use App\Middleware\RoleMiddleware;

final class Router
{
    private const MIDDLEWARE = [
        'auth' => AuthMiddleware::class,
        'guest' => GuestMiddleware::class,
        'csrf' => CsrfMiddleware::class,
        'role' => RoleMiddleware::class,
        'permission' => PermissionMiddleware::class,
        'branch' => BranchScopeMiddleware::class,
        'throttle' => RateLimitMiddleware::class,
    ];

    private array $routes = [];

    public function get(string $path, array $handler, array $middleware = []): void
    {
        $this->add('GET', $path, $handler, $middleware);
    }

    public function post(string $path, array $handler, array $middleware = []): void
    {
        $this->add('POST', $path, $handler, $middleware);
    }

    public function put(string $path, array $handler, array $middleware = []): void
    {
        $this->add('PUT', $path, $handler, $middleware);
    }

    public function delete(string $path, array $handler, array $middleware = []): void
    {
        $this->add('DELETE', $path, $handler, $middleware);
    }

    public function add(string $method, string $path, array $handler, array $middleware = []): void
    {
        $normalized = '/' . trim($path, '/');
        $params = [];
        $regex = preg_replace_callback('/\{(\w+)\}/', function (array $match) use (&$params): string {
            $params[] = $match[1];
            return '([^/]+)';
        }, $normalized);
        $this->routes[] = [
            'method' => strtoupper($method),
            'regex' => '#^' . $regex . '$#',
            'params' => $params,
            'handler' => $handler,
            'middleware' => $middleware,
        ];
    }

    public function dispatch(Request $request): void
    {
        Request::setCurrent($request);
        try {
            RequestGuard::enforce();
            foreach ($this->routes as $route) {
                if ($route['method'] !== $request->method()) {
                    continue;
                }
                if (!preg_match($route['regex'], $request->path(), $matches)) {
                    continue;
                }
                $params = [];
                foreach ($route['params'] as $index => $name) {
                    $params[$name] = $matches[$index + 1];
                }
                $request->setRouteParams($params);
                $this->run($route, $request);
                return;
            }
            throw new HttpException(404, 'Không tìm thấy đường dẫn ' . $request->path());
        } catch (\Throwable $exception) {
            ErrorHandler::render($exception);
        }
    }

    private function run(array $route, Request $request): void
    {
        [$class, $method] = $route['handler'];
        $core = function () use ($class, $method, $request): void {
            if (!class_exists($class)) {
                throw new HttpException(500, 'Controller không tồn tại: ' . $class);
            }
            $controller = new $class($request);
            $controller->{$method}(...array_values($request->routeParams()));
        };

        $pipeline = array_reduce(array_reverse($route['middleware']), function (callable $next, string $spec) use ($request): callable {
            return function () use ($spec, $next, $request): void {
                [$name, $argument] = array_pad(explode(':', $spec, 2), 2, null);
                $middlewareClass = self::MIDDLEWARE[$name] ?? null;
                if ($middlewareClass === null) {
                    throw new HttpException(500, 'Middleware không tồn tại: ' . $name);
                }
                $middleware = $argument === null ? new $middlewareClass() : new $middlewareClass($argument);
                $middleware->handle($request, $next);
            };
        }, $core);

        $pipeline();
    }
}
