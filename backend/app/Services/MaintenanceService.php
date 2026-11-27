<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\Env;
use App\Core\Session;
use App\Infrastructure\Cache\FileCache;
use App\Infrastructure\Database\Connection;
use App\Infrastructure\Logging\Logger;
use App\Infrastructure\Security\RateLimiter;
use PDO;

final class MaintenanceService
{
    public function storageStats(): array
    {
        $pdo = Connection::pdo();
        $dbName = (string) Config::get('database.database', '');

        $tables = [];
        $dbTotalBytes = 0;
        try {
            $stmt = $pdo->prepare(
                'SELECT TABLE_NAME, TABLE_ROWS, COALESCE(DATA_LENGTH, 0) + COALESCE(INDEX_LENGTH, 0) AS total_bytes
                 FROM information_schema.TABLES
                 WHERE TABLE_SCHEMA = ?
                 ORDER BY total_bytes DESC'
            );
            $stmt->execute([$dbName]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $bytes = (int) ($row['total_bytes'] ?? 0);
                $dbTotalBytes += $bytes;
                $tables[] = [
                    'name' => (string) $row['TABLE_NAME'],
                    'rows' => (int) ($row['TABLE_ROWS'] ?? 0),
                    'bytes' => $bytes,
                    'mb' => round($bytes / 1048576, 2),
                ];
            }
        } catch (\Throwable) {
            // Một số shared host hạn chế quyền đọc information_schema
        }

        $folders = [
            'uploads' => $this->dirStats(BASE_PATH . '/storage/uploads'),
            'cache' => $this->dirStats(BASE_PATH . '/storage/cache'),
            'logs' => $this->dirStats(BASE_PATH . '/storage/logs'),
            'sessions' => $this->dirStats(BASE_PATH . '/storage/sessions'),
            'backups' => $this->dirStats(BASE_PATH . '/storage/backups'),
        ];

        $diskBytes = 0;
        $diskFiles = 0;
        foreach ($folders as $stat) {
            $diskBytes += $stat['bytes'];
            $diskFiles += $stat['files'];
        }

        return [
            'database' => [
                'name' => $dbName,
                'total_bytes' => $dbTotalBytes,
                'total_mb' => round($dbTotalBytes / 1048576, 2),
                'tables' => $tables,
            ],
            'storage' => [
                'total_bytes' => $diskBytes,
                'total_mb' => round($diskBytes / 1048576, 2),
                'total_files' => $diskFiles,
                'folders' => $folders,
            ],
            'retention' => [
                'db_log_keep_days' => max(7, Env::int('DB_LOG_KEEP_DAYS', 90)),
                'file_log_keep_days' => max(1, Env::int('LOG_KEEP_DAYS', 14)),
                'gd_available' => extension_loaded('gd'),
                'upload_max_dimension' => max(120, (int) Config::get('upload.max_dimension', 480)),
            ],
        ];
    }

    public function cleanup(?int $dbLogKeepDays = null): array
    {
        $keepDays = max(7, $dbLogKeepDays ?? Env::int('DB_LOG_KEEP_DAYS', 90));
        $cacheRemoved = FileCache::flush();
        $rateLimitRemoved = RateLimiter::gc();
        $sessionRemoved = Session::gc((int) Config::get('auth.session.lifetime', 120) * 60);
        $logFilesRemoved = Logger::pruneOldLogs();

        $dbPruned = (new ActivityLogService())->pruneOldLogs($keepDays, 5000);

        $optimized = false;
        try {
            $pdo = Connection::pdo();
            $pdo->exec('OPTIMIZE TABLE activity_logs, login_histories');
            $optimized = true;
        } catch (\Throwable) {
            // Một số host miễn phí không cho phép OPTIMIZE TABLE -> bỏ qua an toàn
        }

        return [
            'files_removed' => [
                'cache' => $cacheRemoved,
                'rate_limit' => $rateLimitRemoved,
                'sessions' => $sessionRemoved,
                'logs' => $logFilesRemoved,
            ],
            'db_rows_removed' => [
                'activity_logs' => (int) ($dbPruned['activity_logs'] ?? 0),
                'login_histories' => (int) ($dbPruned['login_histories'] ?? 0),
            ],
            'db_log_keep_days' => $keepDays,
            'tables_optimized' => $optimized,
            'stats' => $this->storageStats(),
        ];
    }

    public function streamSqlBackup(): never
    {
        @set_time_limit(120);
        $pdo = Connection::pdo();
        $dbName = (string) Config::get('database.database', 'happykidsck');
        $safeDb = preg_replace('/[^A-Za-z0-9_-]/', '_', $dbName) ?: 'happykidsck';
        $filename = $safeDb . '-backup-' . date('Ymd-His') . '.sql';

        if (function_exists('ob_get_level')) {
            while (ob_get_level() > 0) {
                @ob_end_clean();
            }
        }

        header('Content-Type: application/sql; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');

        echo "-- HappyKidsCK Database Backup (Web Export)\n";
        echo '-- Database: ' . $dbName . "\n";
        echo '-- Created at: ' . date('Y-m-d H:i:s') . "\n\n";
        echo "SET NAMES utf8mb4;\n";
        echo "SET FOREIGN_KEY_CHECKS = 0;\n";
        echo "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n";

        $pdo->exec('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $pdo->beginTransaction();

        try {
            $tables = $pdo->query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')->fetchAll(PDO::FETCH_NUM);
            foreach ($tables as $tableRow) {
                $table = (string) $tableRow[0];
                $quotedTable = '`' . str_replace('`', '``', $table) . '`';

                $createRow = $pdo->query("SHOW CREATE TABLE {$quotedTable}")->fetch(PDO::FETCH_NUM);
                if (!is_array($createRow) || !isset($createRow[1])) {
                    continue;
                }

                echo "-- --------------------------------------------------------\n";
                echo "-- Table structure for {$quotedTable}\n";
                echo "-- --------------------------------------------------------\n";
                echo "DROP TABLE IF EXISTS {$quotedTable};\n";
                echo (string) $createRow[1] . ";\n\n";

                $columns = [];
                foreach ($pdo->query("SHOW COLUMNS FROM {$quotedTable}")->fetchAll(PDO::FETCH_ASSOC) as $col) {
                    $extra = strtolower((string) ($col['Extra'] ?? ''));
                    if (str_contains($extra, 'generated')) {
                        continue;
                    }
                    $columns[] = (string) $col['Field'];
                }
                if ($columns === []) {
                    continue;
                }

                $columnList = implode(', ', array_map(
                    static fn (string $c): string => '`' . str_replace('`', '``', $c) . '`',
                    $columns
                ));

                $stmt = $pdo->query("SELECT {$columnList} FROM {$quotedTable}");
                $batch = [];
                while (($row = $stmt->fetch(PDO::FETCH_ASSOC)) !== false) {
                    $values = [];
                    foreach ($columns as $colName) {
                        $val = $row[$colName] ?? null;
                        if ($val === null) {
                            $values[] = 'NULL';
                        } elseif (is_int($val) || is_float($val)) {
                            $values[] = (string) $val;
                        } else {
                            $values[] = $pdo->quote((string) $val);
                        }
                    }
                    $batch[] = '(' . implode(', ', $values) . ')';
                    if (count($batch) >= 100) {
                        echo "INSERT INTO {$quotedTable} ({$columnList}) VALUES\n" . implode(",\n", $batch) . ";\n";
                        $batch = [];
                        flush();
                    }
                }
                if ($batch !== []) {
                    echo "INSERT INTO {$quotedTable} ({$columnList}) VALUES\n" . implode(",\n", $batch) . ";\n";
                    flush();
                }
                echo "\n";
            }

            if ($pdo->inTransaction()) {
                $pdo->commit();
            }
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            echo "\n-- Backup interrupted: " . str_replace(["\r", "\n"], ' ', $exception->getMessage()) . "\n";
        }

        echo "SET FOREIGN_KEY_CHECKS = 1;\n";
        flush();
        exit;
    }

    private function dirStats(string $dir): array
    {
        if (!is_dir($dir)) {
            return ['files' => 0, 'bytes' => 0, 'mb' => 0.0];
        }
        $files = 0;
        $bytes = 0;
        try {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS)
            );
            foreach ($iterator as $item) {
                if (!$item->isFile()) {
                    continue;
                }
                $name = $item->getFilename();
                if ($name === '.htaccess' || $name === '.gitkeep') {
                    continue;
                }
                $files++;
                $bytes += (int) $item->getSize();
            }
        } catch (\Throwable) {
            // Bỏ qua nếu thư mục không đọc được
        }
        return [
            'files' => $files,
            'bytes' => $bytes,
            'mb' => round($bytes / 1048576, 2),
        ];
    }
}
