<?php
declare(strict_types=1);

use App\Core\Env;

return [
    'max_size_mb' => Env::int('UPLOAD_MAX_SIZE_MB', 2),
    'allowed_ext' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) Env::get('UPLOAD_ALLOWED_EXT', 'jpg,jpeg,png,webp'))
    ))),
    'dir' => Env::get('UPLOAD_DIR', 'storage/uploads'),
];
