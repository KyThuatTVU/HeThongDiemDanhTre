<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Core\Config;
use App\Core\Request;
use App\Core\Session;
use App\Exceptions\HttpException;

final class CsrfMiddleware
{
    public function handle(Request $request, \Closure $next): void
    {
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            $next();
            return;
        }
        $token = $request->header('X-CSRF-Token') ?? (string) $request->input('_token', '');
        if (!Session::validateCsrf($token)) {
            throw new HttpException(419, 'CSRF token không hợp lệ hoặc đã hết hạn. Vui lòng tải lại trang.');
        }
        if (!$this->isTrustedSource($request)) {
            throw new HttpException(419, 'Nguồn gửi yêu cầu không hợp lệ. Vui lòng tải lại trang và thử lại.');
        }
        $next();
    }

    private function isTrustedSource(Request $request): bool
    {
        if (!(bool) Config::get('security.csrf.check_origin', true)) {
            return true;
        }
        $source = (string) ($request->header('Origin') ?? '');
        if ($source === '') {
            $source = (string) ($request->header('Referer') ?? '');
        }
        if ($source === '') {
            return true;
        }
        $origin = $this->normalizeOrigin($source);
        if ($origin === null) {
            return false;
        }
        return in_array($origin, $this->trustedOrigins($request), true);
    }

    private function trustedOrigins(Request $request): array
    {
        $origins = [];
        foreach ([Config::get('app.url'), Config::get('app.frontend_url')] as $url) {
            $origin = is_string($url) ? $this->normalizeOrigin($url) : null;
            if ($origin !== null) {
                $origins[] = $origin;
            }
        }
        foreach ((array) Config::get('security.csrf.trusted_origins', []) as $url) {
            $origin = is_string($url) ? $this->normalizeOrigin($url) : null;
            if ($origin !== null) {
                $origins[] = $origin;
            }
        }
        $host = (string) ($request->header('Host') ?? '');
        if ($host !== '') {
            $origin = $this->normalizeOrigin($this->requestScheme() . '://' . $host);
            if ($origin !== null) {
                $origins[] = $origin;
            }
        }
        return array_values(array_unique($origins));
    }

    private function normalizeOrigin(string $url): ?string
    {
        $parts = parse_url($url);
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return null;
        }
        $scheme = strtolower((string) $parts['scheme']);
        if (!in_array($scheme, ['http', 'https'], true)) {
            return null;
        }
        $port = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);
        return $scheme . '://' . strtolower((string) $parts['host']) . ':' . $port;
    }

    private function requestScheme(): string
    {
        if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            return 'https';
        }
        if (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https') {
            return 'https';
        }
        return 'http';
    }
}
