<?php
declare(strict_types=1);

use App\Core\Env;

return [
    'name' => Env::get('APP_NAME', 'HappyKidsCK'),
    'env' => Env::get('APP_ENV', 'production'),
    'debug' => Env::bool('APP_DEBUG', false),
    'url' => rtrim((string) Env::get('APP_URL', 'http://localhost/HeThongDiemDanhTre/backend/public'), '/'),
    'frontend_url' => rtrim((string) Env::get(
        'FRONTEND_URL',
        str_replace('/backend/public', '/frontend', (string) Env::get('APP_URL', 'http://localhost/HeThongDiemDanhTre/backend/public'))
    ), '/'),
    'timezone' => Env::get('APP_TIMEZONE', 'Asia/Ho_Chi_Minh'),
    'locale' => Env::get('APP_LOCALE', 'vi'),
    'key' => Env::get('APP_KEY', ''),
];
