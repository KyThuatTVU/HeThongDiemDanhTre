<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

require dirname(__DIR__) . '/bootstrap/init.php';

use App\Core\Config;
use App\Infrastructure\Database\Connection;

$options = getopt('', ['include-logs', 'out-dir:', 'help']);
if (!is_array($options)) {
    $options = [];
}

if (isset($options['help'])) {
    echo "Cách dùng: php backend/bin/export-hosting-sql.php [--include-logs] [--out-dir=PATH]\n\n";
    echo "Tạo 2 tệp SQL chuẩn hosting (không có CREATE DATABASE / USE / LOCK TABLES):\n";
    echo "  1. happykidsck_hosting_deploy.sql     — Đưa lên host lần đầu hoặc đồng bộ đè toàn bộ (1 lần bấm, không cần xóa bảng cũ).\n";
    echo "  2. happykidsck_hosting_safe_sync.sql  — Cập nhật học viên/lớp/tài khoản lên host đang chạy mà KHÔNG mất điểm danh/học phí cũ.\n";
    exit(0);
}

$includeLogs = array_key_exists('include-logs', $options);
$outDir = isset($options['out-dir']) && is_string($options['out-dir']) && trim($options['out-dir']) !== ''
    ? rtrim(trim($options['out-dir']), '/\\')
    : BASE_PATH . '/database';

if (!is_dir($outDir) && !@mkdir($outDir, 0775, true) && !is_dir($outDir)) {
    fwrite(STDERR, "Không tạo được thư mục đích: {$outDir}\n");
    exit(1);
}

// Thứ tự bảng cha -> con để sạch sẽ, dễ đọc và không vướng khóa ngoại
$preferredOrder = [
    'branches',
    'roles',
    'permissions',
    'role_permissions',
    'users',
    'user_branches',
    'user_permissions',
    'user_remember_tokens',
    'classes',
    'students',
    'student_class_histories',
    'student_branch_histories',
    'attendance_sessions',
    'attendance',
    'tuition_records',
    'tuition_adjustments',
    'tuition_payments',
    'system_settings',
    'activity_logs',
    'login_histories',
];

// Bảng nhật ký local mặc định bỏ qua dữ liệu khi đưa lên host sạch
$logTables = ['activity_logs', 'login_histories'];

// Bảng token phiên/thiết bị local: luôn chỉ xuất cấu trúc, không mang token máy local lên host
$ephemeralTables = ['user_remember_tokens'];

// Các bảng danh mục/hồ sơ được đồng bộ an toàn (upsert) mà không đụng điểm danh/học phí đang chạy trên host
$safeSyncDataTables = [
    'branches',
    'roles',
    'permissions',
    'role_permissions',
    'users',
    'user_branches',
    'user_permissions',
    'classes',
    'students',
    'student_class_histories',
    'system_settings',
];

/**
 * Chuẩn hóa CREATE TABLE từ MariaDB/MySQL để chạy mượt trên cả MariaDB 10.2+ và MySQL 5.7/8.0+.
 */
function normalizeCreateTable(string $ddl, bool $ifNotExists, bool $stripAutoIncrement): string
{
    // Chuẩn hóa cột JSON của MariaDB (`longtext ... CHECK (json_valid(...))`) thành `longtext DEFAULT NULL`
    // để chạy mượt trên MỌI phiên bản MySQL (5.6/5.7/8.0+) và MariaDB (10.1+).
    $ddl = (string) preg_replace(
        '/`([a-zA-Z0-9_]+)`\s+longtext\s+CHARACTER SET utf8mb4\s+COLLATE utf8mb4_bin\s+DEFAULT NULL(\s+COMMENT\s+\'(?:\\\\.|[^\'])*\')?\s+CHECK\s*\(json_valid\(`\1`\)\)/i',
        '`$1` longtext DEFAULT NULL$2',
        $ddl
    );

    // Chuyển cột GENERATED `class_scope` (nếu còn) thành cột thường để tránh lỗi #1901 khi kết hợp FK ON UPDATE CASCADE
    $ddl = (string) preg_replace(
        '/`class_scope`\s+int(?:\(\d+\))?\s+unsigned\s+GENERATED ALWAYS AS\s*\([^)]+\)\s*(?:STORED|VIRTUAL)/i',
        "`class_scope` int(10) unsigned NOT NULL DEFAULT 0 COMMENT '0 = chưa xếp lớp; ngược lại = class_id'",
        $ddl
    );

    // Chuẩn hóa `current_timestamp()` -> `CURRENT_TIMESTAMP` tương thích mọi bản MySQL/MariaDB
    $ddl = (string) preg_replace('/\bcurrent_timestamp\(\)/i', 'CURRENT_TIMESTAMP', $ddl);

    if ($stripAutoIncrement) {
        $ddl = (string) preg_replace('/\s+AUTO_INCREMENT=\d+/i', '', $ddl);
    }

    if ($ifNotExists) {
        $ddl = (string) preg_replace('/^CREATE TABLE\s+/i', 'CREATE TABLE IF NOT EXISTS ', $ddl, 1);
    }

    return $ddl;
}

/**
 * @return array{columns: string[], pkColumns: string[]}
 */
function inspectTableColumns(PDO $pdo, string $quotedTable): array
{
    $columns = [];
    $pkColumns = [];
    foreach ($pdo->query("SHOW COLUMNS FROM {$quotedTable}")->fetchAll(PDO::FETCH_ASSOC) as $col) {
        $extra = strtolower((string) ($col['Extra'] ?? ''));
        if (str_contains($extra, 'generated')) {
            continue;
        }
        $field = (string) $col['Field'];
        $columns[] = $field;
        if (strtoupper((string) ($col['Key'] ?? '')) === 'PRI') {
            $pkColumns[] = $field;
        }
    }
    return ['columns' => $columns, 'pkColumns' => $pkColumns];
}

/**
 * @param resource $handle
 * @param string[] $columns
 * @param string[] $pkColumns
 */
function writeTableInserts(
    PDO $pdo,
    $handle,
    string $quotedTable,
    array $columns,
    array $pkColumns,
    bool $upsertMode
): int {
    if ($columns === []) {
        return 0;
    }

    $columnList = implode(', ', array_map(
        static fn (string $c): string => '`' . str_replace('`', '``', $c) . '`',
        $columns
    ));

    $nonPkColumns = array_values(array_diff($columns, $pkColumns));
    $insertPrefix = "INSERT INTO {$quotedTable} ({$columnList}) VALUES\n";
    $insertSuffix = ";\n";

    if ($upsertMode) {
        if ($nonPkColumns === []) {
            // Bảng khóa ghép toàn bộ (vd: role_permissions, user_branches) -> INSERT IGNORE
            $insertPrefix = "INSERT IGNORE INTO {$quotedTable} ({$columnList}) VALUES\n";
        } else {
            $updates = array_map(
                static function (string $c): string {
                    $q = '`' . str_replace('`', '``', $c) . '`';
                    return "{$q} = VALUES({$q})";
                },
                $nonPkColumns
            );
            $insertSuffix = "\nON DUPLICATE KEY UPDATE\n  " . implode(",\n  ", $updates) . ";\n";
        }
    }

    $stmt = $pdo->query("SELECT {$columnList} FROM {$quotedTable}");
    $batch = [];
    $totalRows = 0;

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
        $totalRows++;

        if (count($batch) >= 100) {
            fwrite($handle, $insertPrefix . implode(",\n", $batch) . $insertSuffix);
            $batch = [];
        }
    }

    if ($batch !== []) {
        fwrite($handle, $insertPrefix . implode(",\n", $batch) . $insertSuffix);
    }

    return $totalRows;
}

function writeSqlFile(
    PDO $pdo,
    string $targetFile,
    array $orderedTables,
    array $dataTables,
    bool $upsertMode,
    string $title,
    string $usageNote
): array {
    $tempFile = $targetFile . '.tmp';
    $handle = @fopen($tempFile, 'wb');
    if ($handle === false) {
        throw new RuntimeException("Không mở được tệp tạm: {$tempFile}");
    }

    $stats = ['tables' => 0, 'rows' => 0];

    try {
        fwrite($handle, "-- ============================================================\n");
        fwrite($handle, "-- {$title}\n");
        fwrite($handle, '-- Xuất lúc: ' . date('Y-m-d H:i:s') . " (UTC+7)\n");
        fwrite($handle, "-- {$usageNote}\n");
        fwrite($handle, "-- Tương thích: MariaDB 10.2+ & MySQL 5.7/8.0+ (ByetHost/cPanel)\n");
        fwrite($handle, "-- Lưu ý: KHÔNG có CREATE DATABASE / USE / LOCK TABLES.\n");
        fwrite($handle, "--        Chỉ cần chọn sẵn database trên phpMyAdmin -> Import -> Go.\n");
        fwrite($handle, "-- ============================================================\n\n");
        fwrite($handle, "SET NAMES utf8mb4;\n");
        fwrite($handle, "SET TIME_ZONE = '+07:00';\n");
        fwrite($handle, "SET FOREIGN_KEY_CHECKS = 0;\n");
        fwrite($handle, "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n");

        foreach ($orderedTables as $table) {
            $quotedTable = '`' . str_replace('`', '``', $table) . '`';
            $createRow = $pdo->query("SHOW CREATE TABLE {$quotedTable}")->fetch(PDO::FETCH_NUM);
            if (!is_array($createRow) || !isset($createRow[1])) {
                continue;
            }

            $shouldExportData = in_array($table, $dataTables, true);
            $ddl = normalizeCreateTable(
                (string) $createRow[1],
                $upsertMode,
                !$shouldExportData || $upsertMode
            );

            fwrite($handle, "-- ------------------------------------------------------------\n");
            fwrite($handle, "-- Bảng {$quotedTable}" . ($shouldExportData ? '' : ' (chỉ cấu trúc, không chép dữ liệu)') . "\n");
            fwrite($handle, "-- ------------------------------------------------------------\n");
            if (!$upsertMode) {
                fwrite($handle, "DROP TABLE IF EXISTS {$quotedTable};\n");
            }
            fwrite($handle, $ddl . ";\n\n");
            $stats['tables']++;

            if ($shouldExportData) {
                $meta = inspectTableColumns($pdo, $quotedTable);
                $written = writeTableInserts($pdo, $handle, $quotedTable, $meta['columns'], $meta['pkColumns'], $upsertMode);
                $stats['rows'] += $written;
                if ($written > 0) {
                    fwrite($handle, "\n");
                }
            }
        }

        fwrite($handle, "SET FOREIGN_KEY_CHECKS = 1;\n");
    } finally {
        fclose($handle);
    }

    if (!@rename($tempFile, $targetFile)) {
        @unlink($tempFile);
        throw new RuntimeException("Không lưu hoàn tất tệp: {$targetFile}");
    }

    $stats['size_kb'] = round((float) filesize($targetFile) / 1024, 1);
    return $stats;
}

try {
    $pdo = Connection::pdo();
    $pdo->exec('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $pdo->beginTransaction();

    $existing = array_map(
        static fn (array $row): string => (string) $row[0],
        $pdo->query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')->fetchAll(PDO::FETCH_NUM)
    );

    $orderedTables = [];
    foreach ($preferredOrder as $t) {
        if (in_array($t, $existing, true)) {
            $orderedTables[] = $t;
        }
    }
    foreach ($existing as $t) {
        if (!in_array($t, $orderedTables, true)) {
            $orderedTables[] = $t;
        }
    }

    $deployDataTables = $includeLogs
        ? array_values(array_diff($orderedTables, $ephemeralTables))
        : array_values(array_diff($orderedTables, $logTables, $ephemeralTables));

    $safeDataTables = array_values(array_intersect($orderedTables, $safeSyncDataTables));

    $deployPath = $outDir . '/happykidsck_hosting_deploy.sql';
    $safeSyncPath = $outDir . '/happykidsck_hosting_safe_sync.sql';

    $deployStats = writeSqlFile(
        $pdo,
        $deployPath,
        $orderedTables,
        $deployDataTables,
        false,
        'HappyKidsCK — Hosting Full Deploy (1-Click Import / Re-Import)',
        'Dùng cho lần đầu đưa lên host hoặc khi muốn đồng bộ đè toàn bộ (tự DROP/CREATE từng bảng, không cần xóa DB).'
    );

    $safeStats = writeSqlFile(
        $pdo,
        $safeSyncPath,
        $orderedTables,
        $safeDataTables,
        true,
        'HappyKidsCK — Hosting Safe Sync (Không xóa dữ liệu cũ trên host)',
        'Dùng khi host đã có dữ liệu điểm danh/học phí thật và muốn thêm/cập nhật học viên, lớp, tài khoản từ máy lên host.'
    );

    if ($pdo->inTransaction()) {
        $pdo->commit();
    }

    $dbName = (string) ((array) Config::get('database', []))['database'] ?? 'happykidsck';
    echo "Đã xuất thành công từ CSDL '{$dbName}':\n";
    echo "1) {$deployPath}\n";
    echo "   -> {$deployStats['tables']} bảng, {$deployStats['rows']} dòng dữ liệu, {$deployStats['size_kb']} KB\n";
    echo "2) {$safeSyncPath}\n";
    echo "   -> {$safeStats['tables']} bảng (giữ dữ liệu cũ), {$safeStats['rows']} dòng danh mục/hồ sơ, {$safeStats['size_kb']} KB\n";
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'Xuất SQL hosting thất bại: ' . $e->getMessage() . "\n");
    exit(1);
}
