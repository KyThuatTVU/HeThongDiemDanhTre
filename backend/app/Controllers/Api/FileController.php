<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Exceptions\HttpException;
use App\Infrastructure\Storage\FileStorage;
use App\Services\AuthorizationService;

final class FileController extends Controller
{
    public function show(string $module, string $filename): never
    {
        if (!preg_match('/^[a-z0-9_-]+$/', $module) || !preg_match('/^[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/', $filename)) {
            throw new HttpException(404, 'Tệp không tồn tại');
        }
        $relative = $module . '/' . $filename;
        $absolute = FileStorage::absolutePath($relative);
        if ($absolute === null) {
            throw new HttpException(404, 'Tệp không tồn tại');
        }

        $authz = new AuthorizationService();
        if ($module === 'students') {
            $authz->ensure('students.view');
        } elseif ($module === 'users') {
            $user = $this->user();
            $isSelf = $user !== null && (string) $user->avatar_path === $relative;
            if (!$isSelf) {
                $authz->ensure('staff.view');
            }
        } elseif ($module !== 'branches') {
            throw new HttpException(404, 'Tệp không tồn tại');
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($absolute) ?: 'application/octet-stream';
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . (string) filesize($absolute));
        header('Cache-Control: private, max-age=3600');
        readfile($absolute);
        exit;
    }
}
