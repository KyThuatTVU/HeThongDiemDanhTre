<?php
declare(strict_types=1);

use App\Core\Env;

$detectedBase = Env::detectedBaseUrl();

$rawAppUrl = trim((string) Env::get('APP_URL', ''));
if ($rawAppUrl === '' || strtolower($rawAppUrl) === 'auto') {
    $appUrl = $detectedBase !== ''
        ? $detectedBase . '/backend/public'
        : 'http://localhost/HeThongDiemDanhTre/backend/public';
} else {
    $appUrl = rtrim($rawAppUrl, '/');
}

$rawFrontendUrl = trim((string) Env::get('FRONTEND_URL', ''));
if ($rawFrontendUrl === '' || strtolower($rawFrontendUrl) === 'auto') {
    $frontendUrl = $detectedBase !== ''
        ? $detectedBase . '/frontend'
        : str_replace('/backend/public', '/frontend', $appUrl);
} else {
    $frontendUrl = rtrim($rawFrontendUrl, '/');
}

return [
    'name' => Env::get('APP_NAME', 'HappyKidsCK'),
    'env' => Env::get('APP_ENV', 'production'),
    'debug' => Env::bool('APP_DEBUG', false),
    'url' => $appUrl,
    'frontend_url' => $frontendUrl,
    'timezone' => Env::get('APP_TIMEZONE', 'Asia/Ho_Chi_Minh'),
    'locale' => Env::get('APP_LOCALE', 'vi'),
    'key' => Env::get('APP_KEY', ''),
];
