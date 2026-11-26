<?php
declare(strict_types=1);

use App\Core\Config;
use App\Core\Session;

if (!function_exists('e')) {
    function e(mixed $value): string
    {
        return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('config')) {
    function config(string $key, mixed $default = null): mixed
    {
        return Config::get($key, $default);
    }
}

if (!function_exists('url')) {
    function url(string $path = ''): string
    {
        return rtrim((string) Config::get('app.url', ''), '/') . '/' . ltrim($path, '/');
    }
}

if (!function_exists('now')) {
    function now(string $format = 'Y-m-d H:i:s'): string
    {
        return date($format);
    }
}

if (!function_exists('today')) {
    function today(): string
    {
        return date('Y-m-d');
    }
}

if (!function_exists('format_money')) {
    function format_money(mixed $amount): string
    {
        return number_format((float) $amount, 0, ',', '.') . ' đ';
    }
}

if (!function_exists('format_date')) {
    function format_date(?string $date, string $format = 'd/m/Y'): string
    {
        if ($date === null || $date === '' || $date === '0000-00-00') {
            return '';
        }
        $timestamp = strtotime($date);
        return $timestamp === false ? '' : date($format, $timestamp);
    }
}

if (!function_exists('current_user_id')) {
    function current_user_id(): int
    {
        return (int) Session::get('user_id', 0);
    }
}
