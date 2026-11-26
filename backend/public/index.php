<?php
declare(strict_types=1);

use App\Core\Request;

/** @var \App\Core\Router $router */
$router = require dirname(__DIR__) . '/bootstrap/app.php';
$router->dispatch(Request::capture());
