<?php
declare(strict_types=1);

namespace App\Core;

use App\Exceptions\HttpException;
use App\Exceptions\ValidationException;
use App\Infrastructure\Logging\Logger;

final class ErrorHandler
{
    private static bool $debug = false;

    public static function register(bool $debug): void
    {
        self::$debug = $debug;
        ini_set('display_errors', '0');
        error_reporting(E_ALL);
        set_exception_handler([self::class, 'render']);
    }

    public static function render(\Throwable $exception): void
    {
        $status = $exception instanceof HttpException ? $exception->getStatusCode() : 500;
        // Chỉ ghi log lỗi hệ thống (>=500) để tránh phình file log từ lỗi thao tác thông thường (401/404/419/422)
        // và không ghi tham số hàm vào trace để tránh lộ mật khẩu.
        if ($status >= 500) {
            Logger::error($exception->getMessage(), [
                'exception' => $exception::class,
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'trace' => self::$debug ? self::safeTrace($exception) : null,
            ]);
        }

        $databaseError = $exception instanceof \PDOException;
        $message = $exception instanceof HttpException
            ? $exception->getMessage()
            : ((self::$debug && !$databaseError) ? $exception->getMessage() : 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau');

        $payload = ['message' => $message];
        if ($exception instanceof ValidationException) {
            $payload['errors'] = $exception->errors();
        }

        $request = Request::current();
        $wantsJson = $request !== null && $request->wantsJson();

        if ($wantsJson) {
            Response::status($status);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;
        }

        Response::status($status);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        $safeMessage = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
        echo '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' . $status . ' - HappyKidsCK</title></head>'
            . '<body style="font-family:sans-serif;padding:40px"><h1>' . $status . '</h1><p>' . $safeMessage . '</p></body></html>';
        exit;
    }

    private static function safeTrace(\Throwable $exception): string
    {
        $lines = [];
        foreach (array_slice($exception->getTrace(), 0, 10) as $idx => $frame) {
            $location = isset($frame['file']) ? ($frame['file'] . '(' . ($frame['line'] ?? 0) . ')') : '[internal]';
            $call = ($frame['class'] ?? '') . ($frame['type'] ?? '') . ($frame['function'] ?? '');
            $lines[] = '#' . $idx . ' ' . $location . ': ' . $call . '()';
        }
        return implode("\n", $lines);
    }
}
