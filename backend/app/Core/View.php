<?php
declare(strict_types=1);

namespace App\Core;

use App\Exceptions\HttpException;

final class View
{
    public static function render(string $view, array $data = []): void
    {
        $file = BASE_PATH . '/app/Views/' . str_replace('.', '/', $view) . '.php';
        if (!is_file($file)) {
            throw new HttpException(500, 'View chưa được tạo: ' . $view);
        }
        extract($data, EXTR_SKIP);
        require $file;
    }
}
