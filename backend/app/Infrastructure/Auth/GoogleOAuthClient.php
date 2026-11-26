<?php
declare(strict_types=1);

namespace App\Infrastructure\Auth;

use App\Core\Config;
use App\Exceptions\HttpException;

final class GoogleOAuthClient
{
    public function isConfigured(): bool
    {
        return (string) Config::get('auth.google.client_id', '') !== ''
            && (string) Config::get('auth.google.client_secret', '') !== ''
            && (string) Config::get('auth.google.redirect_uri', '') !== '';
    }

    public function buildAuthUrl(string $state): string
    {
        if (!$this->isConfigured()) {
            throw new HttpException(503, 'Đăng nhập Google chưa được cấu hình');
        }
        return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id' => Config::get('auth.google.client_id'),
            'redirect_uri' => Config::get('auth.google.redirect_uri'),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'prompt' => 'select_account',
            'access_type' => 'online',
        ]);
    }

    public function fetchUser(string $code): array
    {
        if (!$this->isConfigured()) {
            throw new HttpException(503, 'Đăng nhập Google chưa được cấu hình');
        }
        $token = $this->post('https://oauth2.googleapis.com/token', [
            'code' => $code,
            'client_id' => Config::get('auth.google.client_id'),
            'client_secret' => Config::get('auth.google.client_secret'),
            'redirect_uri' => Config::get('auth.google.redirect_uri'),
            'grant_type' => 'authorization_code',
        ]);
        $accessToken = $token['access_token'] ?? null;
        if (!is_string($accessToken) || $accessToken === '') {
            throw new HttpException(502, 'Không lấy được access token từ Google');
        }
        $user = $this->get('https://www.googleapis.com/oauth2/v3/userinfo', $accessToken);
        $googleId = $user['sub'] ?? null;
        if (!is_string($googleId) || $googleId === '') {
            throw new HttpException(502, 'Không lấy được mã định danh tài khoản từ Google');
        }
        $email = $user['email'] ?? null;
        if (!is_string($email) || $email === '') {
            throw new HttpException(502, 'Không lấy được email từ Google');
        }
        return [
            'google_id' => $googleId,
            'email' => strtolower($email),
            'name' => (string) ($user['name'] ?? ''),
            'avatar' => (string) ($user['picture'] ?? ''),
            'email_verified' => filter_var($user['email_verified'] ?? false, FILTER_VALIDATE_BOOL),
        ];
    }

    private function post(string $url, array $fields): array
    {
        return $this->request($url, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($fields),
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        ]);
    }

    private function get(string $url, string $accessToken): array
    {
        return $this->request($url, [
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken],
        ]);
    }

    private function request(string $url, array $options): array
    {
        $handle = curl_init($url);
        curl_setopt_array($handle, $options + [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $response = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);

        if ($response === false) {
            throw new HttpException(502, 'Không kết nối được tới Google: ' . $error);
        }
        $decoded = json_decode((string) $response, true);
        if ($status >= 400 || !is_array($decoded)) {
            $description = is_array($decoded) ? (string) ($decoded['error_description'] ?? $decoded['error'] ?? '') : '';
            throw new HttpException(502, 'Google trả về lỗi: ' . ($description !== '' ? $description : 'HTTP ' . $status));
        }
        return $decoded;
    }
}
