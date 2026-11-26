<?php
declare(strict_types=1);

namespace App\Infrastructure\Logging;

final class Logger
{
    public static function info(string $message, array $context = []): void
    {
        self::write('INFO', $message, $context);
    }

    public static function warning(string $message, array $context = []): void
    {
        self::write('WARNING', $message, $context);
    }

    public static function error(string $message, array $context = []): void
    {
        self::write('ERROR', $message, $context);
    }

    private static function write(string $level, string $message, array $context): void
    {
        $directory = BASE_PATH . '/storage/logs';
        if (!is_dir($directory)) {
            mkdir($directory, 0775, true);
        }
        $context = array_filter($context, static fn ($value): bool => $value !== null && $value !== '');
        $line = sprintf(
            '[%s] [%s] %s %s%s',
            date('Y-m-d H:i:s'),
            $level,
            $message,
            $context === [] ? '' : json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            PHP_EOL
        );
        @file_put_contents($directory . '/app-' . date('Y-m-d') . '.log', $line, FILE_APPEND);
    }
}
