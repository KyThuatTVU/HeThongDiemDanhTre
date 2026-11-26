<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Exceptions\HttpException;
use App\Infrastructure\Storage\FileStorage;
use App\Repositories\StudentRepository;
use App\Repositories\UserRepository;
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
            $student = (new StudentRepository())->findByAvatarPath($relative);
            if ($student === null) {
                throw new HttpException(404, 'Tệp không tồn tại');
            }
            $authz->assertBranch((int) $student['branch_id']);
        } elseif ($module === 'users') {
            $user = $this->user();
            $isSelf = $user !== null && (string) $user->avatar_path === $relative;
            if (!$isSelf) {
                $authz->ensure('staff.view');
                $userRepo = new UserRepository();
                $owner = $userRepo->findByAvatarPath($relative);
                if ($owner === null) {
                    throw new HttpException(404, 'Tệp không tồn tại');
                }
                if (!$authz->isSuperAdmin()) {
                    $ownerBranches = $userRepo->branchIds((int) $owner['id']);
                    if (array_intersect($ownerBranches, $authz->currentUserBranchIds()) === []) {
                        throw new HttpException(403, 'Bạn không được xem tệp của nhân viên ngoài cơ sở được phân công');
                    }
                }
            }
        } elseif ($module !== 'branches') {
            throw new HttpException(404, 'Tệp không tồn tại');
        }

        $mimeByExtension = [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
        ];
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $mime = $mimeByExtension[$extension] ?? null;
        if ($mime === null) {
            throw new HttpException(404, 'Tệp không tồn tại');
        }
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . (string) filesize($absolute));
        header('Cache-Control: private, max-age=3600');
        readfile($absolute);
        exit;
    }
}
