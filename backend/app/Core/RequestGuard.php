<?php
declare(strict_types=1);

namespace App\Core;

use App\Exceptions\HttpException;

final class RequestGuard
{
    public static function enforce(): void
    {
        $maxKb = (int) Config::get('security.request.max_body_kb', 0);
        $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($maxKb > 0 && $length > $maxKb * 1024) {
            throw new HttpException(413, 'Dữ liệu gửi lên vượt quá giới hạn cho phép');
        }
    }
}
