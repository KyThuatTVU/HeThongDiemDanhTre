<?php
declare(strict_types=1);

namespace App\Infrastructure\Logging;

use App\Core\Env;

final class Logger
{
    private const LEVEL_ORDER = [
        'debug' => 10,
        'info' => 20,
        'warning' => 30,
        'error' => 40,
    ];

    private const MAX_DAILY_BYTES = 2 * 1024 * 1024; // 2MB/ngày tránh phình đĩa host miễn phí

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

    public static function pruneOldLogs(?int $keepDays = null): int
    {
        $days = max(1, $keepDays ?? Env::int('LOG_KEEP_DAYS', 14));
        $directory = BASE_PATH . '/storage/logs';
        if (!is_dir($directory)) {
            return 0;
        }
        $deadline = time() - ($days * 86400);
        $removed = 0;
        foreach (glob($directory . '/app-*.log') ?: [] as $file) {
            if (!is_file($file)) {
                continue;
            }
            $mtime = @filemtime($file);
            if ($mtime !== false && $mtime < $deadline && @unlink($file)) {
                $removed++;
            }
        }
        return $removed;
    }

    private static function write(string $level, string $message, array $context): void
    {
        $configured = strtolower(trim((string) Env::get('LOG_LEVEL', 'warning')));
        $minWeight = self::LEVEL_ORDER[$configured] ?? self::LEVEL_ORDER['warning'];
        $currentWeight = self::LEVEL_ORDER[strtolower($level)] ?? self::LEVEL_ORDER['info'];
        if ($currentWeight < $minWeight) {
            return;
        }

        $directory = BASE_PATH . '/storage/logs';
        if (!is_dir($directory)) {
            @mkdir($directory, 0775, true);
        }
        $file = $directory . '/app-' . date('Y-m-d') . '.log';
        if (is_file($file) && (int) @filesize($file) >= self::MAX_DAILY_BYTES) {
            return;
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
        @file_put_contents($file, $line, FILE_APPEND | LOCK_EX);

        try {
            if (random_int(1, 50) === 1) {
                self::pruneOldLogs();
            }
        } catch (\Throwable) {
            // Bỏ qua
        }
    }
}
