<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Core\Response;

final class SystemController extends Controller
{
    public function health(): never
    {
        Response::json([
            'status' => 'ok',
            'app' => config('app.name'),
            'time' => now(),
        ]);
    }

    public function info(): never
    {
        Response::json([
            'app' => config('app.name'),
            'message' => 'HappyKidsCK Backend API',
            'version' => '1.0.0',
            'health' => url('/health'),
            'csrf' => url('/api/auth/csrf'),
            'login' => url('/api/auth/login'),
        ]);
    }
}
