<?php
declare(strict_types=1);

use App\Core\Env;

$trustedOrigins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) Env::get('CSRF_TRUSTED_ORIGINS', ''))
)));

return [
    'headers' => [
        'hsts' => Env::bool('SECURITY_HSTS', true),
    ],
    'csrf' => [
        'check_origin' => Env::bool('CSRF_CHECK_ORIGIN', true),
        'trusted_origins' => $trustedOrigins,
    ],
    'request' => [
        'max_body_kb' => Env::int('SECURITY_MAX_BODY_KB', 8192),
        'max_execution_seconds' => Env::int('SECURITY_MAX_EXECUTION_SECONDS', 30),
    ],
    'rate_limit_storage' => Env::get('RATE_LIMIT_STORAGE', 'storage/cache/ratelimit'),
    'rate_limit' => [
        'login' => [
            'field' => 'identifier',
            'scopes' => [
                'ip' => ['max' => Env::int('RATE_LIMIT_LOGIN_IP_MAX', 20), 'window' => 300, 'block' => 900],
                'account' => ['max' => Env::int('RATE_LIMIT_LOGIN_ACCOUNT_MAX', 5), 'window' => 900, 'block' => 900],
            ],
        ],
        'sensitive' => [
            'scopes' => [
                'user' => ['max' => 10, 'window' => 300, 'block' => 900],
                'ip' => ['max' => 30, 'window' => 300, 'block' => 900],
            ],
        ],
        'upload' => [
            'scopes' => [
                'user' => ['max' => 30, 'window' => 600, 'block' => 600],
                'ip' => ['max' => 60, 'window' => 600, 'block' => 600],
            ],
        ],
    ],
];
