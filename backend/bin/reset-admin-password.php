<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

require dirname(__DIR__) . '/bootstrap/init.php';

use App\Infrastructure\Database\Connection;
use App\Infrastructure\Security\PasswordPolicy;

$options = getopt('', ['username:', 'email:', 'name:', 'help']);
if (!is_array($options)) {
    $options = [];
}

if (isset($options['help'])) {
    echo "Cách dùng: php backend/bin/reset-admin-password.php [--username=admin] [--email=...] [--name=...]\n";
    echo "Đặt lại mật khẩu super-admin và in mật khẩu mới một lần duy nhất.\n";
    exit(0);
}

$username = trim((string) ($options['username'] ?? 'admin'));
if ($username === '') {
    fwrite(STDERR, "Tên đăng nhập không được để trống.\n");
    exit(1);
}

$email = null;
if (isset($options['email']) && trim((string) $options['email']) !== '') {
    $email = strtolower(trim((string) $options['email']));
    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        fwrite(STDERR, "Email không hợp lệ.\n");
        exit(1);
    }
}

$fullName = mb_substr(trim((string) ($options['name'] ?? 'Quản trị hệ thống')), 0, 120);

$password = '';
do {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*';
    $password = '';
    for ($i = 0; $i < 20; $i++) {
        $password .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
} while (!preg_match('/\p{L}/u', $password) || !preg_match('/\p{N}/u', $password));

PasswordPolicy::assertValid($password);
$hash = password_hash($password, PASSWORD_DEFAULT);

try {
    $pdo = Connection::pdo();
    $roleStmt = $pdo->prepare("SELECT id FROM roles WHERE role_key = 'super_admin' LIMIT 1");
    $roleStmt->execute();
    $roleId = $roleStmt->fetchColumn();
    if ($roleId === false) {
        fwrite(STDERR, "Chưa import seeds/002_seed_roles_permissions.sql.\n");
        exit(1);
    }

    $userStmt = $pdo->prepare(
        "SELECT u.id, r.role_key, u.username
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.username = ? LIMIT 1"
    );
    $userStmt->execute([$username]);
    $user = $userStmt->fetch();

    if ($user === false) {
        $userStmt = $pdo->prepare(
            "SELECT u.id, r.role_key, u.username
             FROM users u JOIN roles r ON r.id = u.role_id
             WHERE r.role_key = 'super_admin' AND (u.username IS NULL OR u.username = '')
             ORDER BY u.id LIMIT 1"
        );
        $userStmt->execute();
        $user = $userStmt->fetch();
    }

    if (is_array($user) && (string) $user['role_key'] !== 'super_admin') {
        fwrite(STDERR, "Tài khoản '{$username}' không phải super_admin; từ chối đặt lại mật khẩu.\n");
        exit(1);
    }

    if ($email !== null) {
        $emailStmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $emailStmt->execute([$email]);
        $emailOwner = $emailStmt->fetchColumn();
        if ($emailOwner !== false && (!is_array($user) || (int) $emailOwner !== (int) $user['id'])) {
            fwrite(STDERR, "Email đã thuộc một tài khoản khác.\n");
            exit(1);
        }
    }

    $pdo->beginTransaction();

    if (is_array($user)) {
        $assignments = ['password_hash = ?', "status = 'active'"];
        $params = [$hash];
        if ($email !== null) {
            $assignments[] = 'email = ?';
            $params[] = $email;
        }
        if ((string) ($user['username'] ?? '') !== $username) {
            $assignments[] = 'username = ?';
            $params[] = $username;
        }
        $params[] = (int) $user['id'];
        $update = $pdo->prepare('UPDATE users SET ' . implode(', ', $assignments) . ' WHERE id = ?');
        $update->execute($params);
        $accountId = (int) $user['id'];
    } else {
        $insert = $pdo->prepare(
            "INSERT INTO users (role_id, username, email, password_hash, full_name, status)
             VALUES (?, ?, ?, ?, ?, 'active')"
        );
        $insert->execute([(int) $roleId, $username, $email, $hash, $fullName]);
        $accountId = (int) $pdo->lastInsertId();
    }

    $pdo->commit();
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, "Không cập nhật được tài khoản: " . $exception->getMessage() . "\n");
    exit(1);
}

echo "Đã cập nhật tài khoản super-admin #{$accountId} ({$username}).\n";
echo "Mật khẩu mới: {$password}\n";
echo "Hãy lưu mật khẩu này ngay; mật khẩu không được ghi lại ở nơi khác.\n";
