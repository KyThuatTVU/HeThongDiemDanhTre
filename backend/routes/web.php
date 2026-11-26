<?php
declare(strict_types=1);

use App\Controllers\Api\AuthController;
use App\Controllers\Api\SystemController;
use App\Core\Router;

/** @var Router $router */

$router->get('/', [SystemController::class, 'info']);
$router->get('/health', [SystemController::class, 'health']);
$router->get('/auth/google/redirect', [AuthController::class, 'googleRedirect']);
$router->get('/auth/google/callback', [AuthController::class, 'googleCallback']);
