<?php
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));

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

use App\Core\Config;
use App\Core\Env;
use App\Core\ErrorHandler;
use App\Core\Router;
use App\Core\SecurityHeaders;
use App\Core\Session;

Env::load(BASE_PATH . '/.env');
Config::load(BASE_PATH . '/config');

date_default_timezone_set((string) Config::get('app.timezone', 'Asia/Ho_Chi_Minh'));
mb_internal_encoding('UTF-8');
@set_time_limit((int) Config::get('security.request.max_execution_seconds', 30));

ErrorHandler::register((bool) Config::get('app.debug', false));
Session::start((array) Config::get('auth.session', []));
SecurityHeaders::apply();

$router = new Router();
require BASE_PATH . '/routes/web.php';
require BASE_PATH . '/routes/api.php';

return $router;
