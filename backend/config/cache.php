<?php
declare(strict_types=1);

use App\Core\Env;

return [
    'enabled' => Env::bool('CACHE_ENABLED', true),
    'path' => Env::get('CACHE_PATH', 'storage/cache/data'),
    'ttl' => [
        'settings' => Env::int('CACHE_TTL_SETTINGS', 300),
        'branches' => Env::int('CACHE_TTL_BRANCHES', 600),
        'permissions' => Env::int('CACHE_TTL_PERMISSIONS', 600),
        'user_permissions' => Env::int('CACHE_TTL_USER_PERMISSIONS', 120),
        'dashboard' => Env::int('CACHE_TTL_DASHBOARD', 30),
    ],
];
