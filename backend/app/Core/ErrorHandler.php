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
        Logger::error($exception->getMessage(), [
            'exception' => $exception::class,
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => self::$debug ? $exception->getTraceAsString() : null,
        ]);

        $status = $exception instanceof HttpException ? $exception->getStatusCode() : 500;
        $message = $exception instanceof HttpException
            ? $exception->getMessage()
            : (self::$debug ? $exception->getMessage() : 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau');

        $payload = ['message' => $message];
        if ($exception instanceof ValidationException) {
            $payload['errors'] = $exception->errors();
        }

        $request = Request::current();
        $wantsJson = $request !== null && $request->wantsJson();

        if ($wantsJson) {
            http_response_code($status);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;
        }

        http_response_code($status);
        header('Content-Type: text/html; charset=utf-8');
        $safeMessage = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
        echo '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' . $status . ' - HappyKidsCK</title></head>'
            . '<body style="font-family:sans-serif;padding:40px"><h1>' . $status . '</h1><p>' . $safeMessage . '</p></body></html>';
        exit;
    }
}
