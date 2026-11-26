<?php
declare(strict_types=1);

namespace App\Exceptions;

class HttpException extends \RuntimeException
{
    public function __construct(private int $statusCode, string $message = '')
    {
        parent::__construct($message !== '' ? $message : 'Lỗi hệ thống');
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }
}
