<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

require dirname(__DIR__) . '/bootstrap/init.php';

use App\Core\Config;
use App\Core\Env;
use App\Infrastructure\Database\Connection;
use App\Infrastructure\Logging\Logger;

$options = getopt('', ['keep-days:', 'help']);
if (!is_array($options)) {
    $options = [];
}

if (isset($options['help'])) {
    echo "Cách dùng: php backend/bin/backup-database.php [--keep-days=30]\n";
    echo "Sao lưu toàn bộ cơ sở dữ liệu vào backend/storage/backups/ và tự dọn bản cũ.\n";
    exit(0);
}

$keepDays = max(1, (int) ($options['keep-days'] ?? Env::int('BACKUP_KEEP_DAYS', 30)));
$dbConfig = (array) Config::get('database', []);
$dbName = (string) ($dbConfig['database'] ?? 'happykidsck');

$backupDir = BASE_PATH . '/storage/backups';
if (!is_dir($backupDir) && !@mkdir($backupDir, 0775, true) && !is_dir($backupDir)) {
    fwrite(STDERR, "Không tạo được thư mục sao lưu: {$backupDir}\n");
    exit(1);
}

$stamp = date('Ymd-His');
$safeDb = preg_replace('/[^A-Za-z0-9_-]/', '_', $dbName) ?: 'database';
$targetFile = $backupDir . '/' . $safeDb . '-' . $stamp . '.sql';
$tempFile = $targetFile . '.tmp';

try {
    $pdo = Connection::pdo();
    $handle = @fopen($tempFile, 'wb');
    if ($handle === false) {
        throw new RuntimeException('Không mở được tệp tạm để ghi bản sao lưu.');
    }

    try {
        fwrite($handle, "-- HappyKidsCK Database Backup\n");
        fwrite($handle, '-- Database: ' . $dbName . "\n");
        fwrite($handle, '-- Created at: ' . date('Y-m-d H:i:s') . "\n\n");
        fwrite($handle, "SET NAMES utf8mb4;\n");
        fwrite($handle, "SET FOREIGN_KEY_CHECKS = 0;\n");
        fwrite($handle, "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n");

        $pdo->exec('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $pdo->beginTransaction();

        $tables = $pdo->query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')->fetchAll(PDO::FETCH_NUM);
        foreach ($tables as $tableRow) {
            $table = (string) $tableRow[0];
            $quotedTable = '`' . str_replace('`', '``', $table) . '`';

            $createRow = $pdo->query("SHOW CREATE TABLE {$quotedTable}")->fetch(PDO::FETCH_NUM);
            if (!is_array($createRow) || !isset($createRow[1])) {
                continue;
            }

            fwrite($handle, "-- --------------------------------------------------------\n");
            fwrite($handle, "-- Table structure for {$quotedTable}\n");
            fwrite($handle, "-- --------------------------------------------------------\n");
            fwrite($handle, "DROP TABLE IF EXISTS {$quotedTable};\n");
            fwrite($handle, (string) $createRow[1] . ";\n\n");

            // Bỏ qua cột generated (STORED/VIRTUAL) để file restore không bị lỗi MySQL
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
                    fwrite($handle, "INSERT INTO {$quotedTable} ({$columnList}) VALUES\n" . implode(",\n", $batch) . ";\n");
                    $batch = [];
                }
            }
            if ($batch !== []) {
                fwrite($handle, "INSERT INTO {$quotedTable} ({$columnList}) VALUES\n" . implode(",\n", $batch) . ";\n");
            }
            fwrite($handle, "\n");
        }

        if ($pdo->inTransaction()) {
            $pdo->commit();
        }
        fwrite($handle, "SET FOREIGN_KEY_CHECKS = 1;\n");
    } finally {
        fclose($handle);
    }

    if (!@rename($tempFile, $targetFile)) {
        @unlink($tempFile);
        throw new RuntimeException('Không lưu hoàn tất tệp sao lưu.');
    }

    // Dọn các bản sao lưu cũ hơn số ngày quy định
    $deadline = time() - ($keepDays * 86400);
    $pruned = 0;
    foreach (glob($backupDir . '/*.sql') ?: [] as $existing) {
        if ($existing === $targetFile || !is_file($existing)) {
            continue;
        }
        $mtime = @filemtime($existing);
        if ($mtime !== false && $mtime < $deadline && @unlink($existing)) {
            $pruned++;
        }
    }

    $sizeKb = round((float) filesize($targetFile) / 1024, 1);
    Logger::info('Database backup completed', [
        'file' => basename($targetFile),
        'size_kb' => $sizeKb,
        'pruned' => $pruned,
    ]);
    echo "Đã sao lưu thành công: {$targetFile} ({$sizeKb} KB). Đã dọn {$pruned} bản cũ (>{$keepDays} ngày).\n";
    exit(0);
} catch (Throwable $exception) {
    if (is_file($tempFile)) {
        @unlink($tempFile);
    }
    Logger::error('Database backup failed', ['error' => $exception->getMessage()]);
    fwrite(STDERR, 'Sao lưu thất bại: ' . $exception->getMessage() . "\n");
    exit(1);
}
