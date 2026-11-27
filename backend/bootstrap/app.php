<?php
declare(strict_types=1);

require __DIR__ . '/init.php';

use App\Core\Config;
use App\Core\ErrorHandler;
use App\Core\Router;
use App\Core\SecurityHeaders;
use App\Core\Session;

if ((string) Config::get('app.env', 'production') === 'production') {
    $issues = [];
    if ((bool) Config::get('app.debug', false)) {
        $issues[] = 'APP_DEBUG phải là false';
    }
    if (\App\Core\Env::isHttpsRequest() && !(bool) Config::get('auth.session.secure', false)) {
        $issues[] = 'SESSION_SECURE phải là true khi chạy HTTPS';
    }
    if (trim((string) Config::get('database.password', '')) === '') {
        $issues[] = 'DB_PASSWORD không được để trống';
    }
    if (trim((string) Config::get('app.key', '')) === '') {
        $issues[] = 'APP_KEY chưa được cấu hình';
    }
    if (!(bool) Config::get('security.csrf.check_origin', true)) {
        $issues[] = 'CSRF_CHECK_ORIGIN phải bật';
    }
    if (!(bool) Config::get('security.csrf.require_source', true)) {
        $issues[] = 'CSRF_REQUIRE_SOURCE phải bật';
    }
    if ($issues !== []) {
        error_log('Insecure production configuration: ' . implode('; ', $issues));
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Server configuration error';
        exit;
    }
}

@set_time_limit((int) Config::get('security.request.max_execution_seconds', 30));

ErrorHandler::register((bool) Config::get('app.debug', false));
Session::start((array) Config::get('auth.session', []));
SecurityHeaders::apply();

$router = new Router();
require BASE_PATH . '/routes/web.php';
require BASE_PATH . '/routes/api.php';

return $router;
