<?php
declare(strict_types=1);

if (!defined('BASE_PATH')) {
    define('BASE_PATH', dirname(__DIR__));
}

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = BASE_PATH . '/app/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

require BASE_PATH . '/app/Helpers/functions.php';

\App\Core\Env::load(BASE_PATH . '/.env');

// Tự động nạp cấu hình hosting (.env.hosting) khi chạy trên tên miền thật (không phải localhost/CLI),
// hoặc khi ép buộc bằng APP_PROFILE=hosting. Dưới máy local XAMPP vẫn giữ nguyên backend/.env.
$envProfile = strtolower(trim((string) \App\Core\Env::get('APP_PROFILE', 'auto')));
$useHostingEnv = $envProfile === 'hosting'
    || ($envProfile !== 'local' && !\App\Core\Env::isLocalHost());
if ($useHostingEnv && is_file(BASE_PATH . '/.env.hosting')) {
    \App\Core\Env::loadOverlay(BASE_PATH . '/.env.hosting');
}

\App\Core\Config::load(BASE_PATH . '/config');

date_default_timezone_set((string) \App\Core\Config::get('app.timezone', 'Asia/Ho_Chi_Minh'));
mb_internal_encoding('UTF-8');
