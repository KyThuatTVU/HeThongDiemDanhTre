<?php
declare(strict_types=1);

use App\Core\Env;

$allowedEmails = array_values(array_unique(array_filter(array_map(
    static fn (string $email): string => strtolower(trim($email)),
    explode(',', (string) Env::get('GOOGLE_ALLOWED_EMAILS', ''))
), static fn (string $email): bool => $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false)));

$rawSessionSecure = strtolower(trim((string) Env::get('SESSION_SECURE', 'false')));
$sessionSecure = $rawSessionSecure === 'auto'
    ? Env::isHttpsRequest()
    : Env::bool('SESSION_SECURE', false);

$rawGoogleRedirect = trim((string) Env::get('GOOGLE_REDIRECT_URI', ''));
$detectedBase = Env::detectedBaseUrl();
$googleRedirect = ($rawGoogleRedirect === '' || strtolower($rawGoogleRedirect) === 'auto')
    ? ($detectedBase !== '' ? $detectedBase . '/backend/public/auth/google/callback' : '')
    : $rawGoogleRedirect;

return [
    'session' => [
        'name' => Env::get('SESSION_NAME', 'happykidsck_session'),
        'lifetime' => Env::int('SESSION_LIFETIME', 120),
        'idle_minutes' => Env::int('SESSION_IDLE_MINUTES', 30),
        'secure' => $sessionSecure,
        'http_only' => Env::bool('SESSION_HTTP_ONLY', true),
        'same_site' => Env::get('SESSION_SAME_SITE', 'Lax'),
    ],
    'remember' => [
        'cookie_name' => Env::get('REMEMBER_COOKIE_NAME', 'happykidsck_remember'),
        'days' => max(1, min(90, Env::int('REMEMBER_DAYS', 30))),
        'max_devices_per_user' => max(1, min(30, Env::int('REMEMBER_MAX_DEVICES', 10))),
    ],
    'google' => [
        'client_id' => Env::get('GOOGLE_CLIENT_ID', ''),
        'client_secret' => Env::get('GOOGLE_CLIENT_SECRET', ''),
        'redirect_uri' => $googleRedirect,
        'allowed_emails' => $allowedEmails,
    ],
    'roles' => [
        'super_admin' => 'Super Admin',
        'branch_manager' => 'Quản lý cơ sở',
        'attendance_staff' => 'Nhân viên điểm danh',
        'profile_staff' => 'Nhân viên hồ sơ',
    ],
];
