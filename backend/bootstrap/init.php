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
\App\Core\Config::load(BASE_PATH . '/config');

date_default_timezone_set((string) \App\Core\Config::get('app.timezone', 'Asia/Ho_Chi_Minh'));
mb_internal_encoding('UTF-8');
