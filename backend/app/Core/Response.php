<?php
declare(strict_types=1);

namespace App\Core;

final class Response
{
    public static function status(int $status): void
    {
        if ($status === 419) {
            // Apache/PHP đổi mã 419 không chuẩn thành 500 nếu không gửi kèm reason phrase.
            header('HTTP/1.1 419 Authentication Timeout', true, 419);
            return;
        }
        http_response_code($status);
    }

    public static function json(mixed $data, int $status = 200): never
    {
        self::status($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function redirect(string $url, int $status = 302): never
    {
        header('Location: ' . $url, true, $status);
        exit;
    }

    public static function html(string $content, int $status = 200): never
    {
        self::status($status);
        header('Content-Type: text/html; charset=utf-8');
        echo $content;
        exit;
    }

    public static function noContent(): never
    {
        http_response_code(204);
        exit;
    }
}
