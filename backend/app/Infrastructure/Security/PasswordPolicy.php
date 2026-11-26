<?php
declare(strict_types=1);

namespace App\Infrastructure\Security;

use App\Exceptions\HttpException;

final class PasswordPolicy
{
    public static function assertValid(string $password): void
    {
        if (mb_strlen($password) < 10) {
            throw new HttpException(422, 'Mật khẩu phải có ít nhất 10 ký tự');
        }
        if (strlen($password) > 72) {
            throw new HttpException(422, 'Mật khẩu không được vượt quá 72 byte');
        }
        if (!preg_match('/\p{L}/u', $password) || !preg_match('/\p{N}/u', $password)) {
            throw new HttpException(422, 'Mật khẩu phải có ít nhất một chữ cái và một chữ số');
        }
    }
}
