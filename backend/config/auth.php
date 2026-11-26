<?php
declare(strict_types=1);

use App\Core\Env;

$allowedEmails = array_values(array_unique(array_filter(array_map(
    static fn (string $email): string => strtolower(trim($email)),
    explode(',', (string) Env::get('GOOGLE_ALLOWED_EMAILS', ''))
), static fn (string $email): bool => $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false)));

return [
    'session' => [
        'name' => Env::get('SESSION_NAME', 'happykidsck_session'),
        'lifetime' => Env::int('SESSION_LIFETIME', 120),
        'secure' => Env::bool('SESSION_SECURE', false),
        'http_only' => Env::bool('SESSION_HTTP_ONLY', true),
        'same_site' => Env::get('SESSION_SAME_SITE', 'Lax'),
    ],
    'google' => [
        'client_id' => Env::get('GOOGLE_CLIENT_ID', ''),
        'client_secret' => Env::get('GOOGLE_CLIENT_SECRET', ''),
        'redirect_uri' => Env::get('GOOGLE_REDIRECT_URI', ''),
        'allowed_emails' => $allowedEmails,
    ],
    'roles' => [
        'super_admin' => 'Super Admin',
        'branch_manager' => 'Quản lý cơ sở',
        'attendance_staff' => 'Nhân viên điểm danh',
        'profile_staff' => 'Nhân viên hồ sơ',
    ],
];
