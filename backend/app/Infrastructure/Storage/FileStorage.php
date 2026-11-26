<?php
declare(strict_types=1);

namespace App\Infrastructure\Storage;

use App\Core\Config;
use App\Exceptions\HttpException;

final class FileStorage
{
    private const MIME_BY_EXT = [
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'webp' => ['image/webp'],
    ];

    public static function storeImage(array $file, string $module): string
    {
        if (!isset($file['tmp_name'], $file['error'], $file['size'], $file['name'])) {
            throw new HttpException(422, 'Tệp tải lên không hợp lệ');
        }
        if ((int) $file['error'] !== UPLOAD_ERR_OK) {
            throw new HttpException(422, 'Tải hình ảnh thất bại, vui lòng thử lại');
        }
        $maxSize = (int) Config::get('upload.max_size_mb', 2) * 1024 * 1024;
        if ((int) $file['size'] > $maxSize) {
            throw new HttpException(422, 'Hình ảnh vượt quá dung lượng cho phép (' . Config::get('upload.max_size_mb', 2) . 'MB)');
        }
        $allowedExt = (array) Config::get('upload.allowed_ext', ['jpg', 'jpeg', 'png', 'webp']);
        $extension = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, $allowedExt, true)) {
            throw new HttpException(422, 'Chỉ chấp nhận hình ảnh định dạng: ' . implode(', ', $allowedExt));
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file((string) $file['tmp_name']);
        if (!in_array($mime, self::MIME_BY_EXT[$extension] ?? [], true)) {
            throw new HttpException(422, 'Nội dung tệp không phải hình ảnh hợp lệ');
        }
        if (!preg_match('/^[a-z0-9_-]+$/', $module)) {
            throw new HttpException(500, 'Thư mục lưu trữ không hợp lệ');
        }
        $directory = BASE_PATH . '/storage/uploads/' . $module;
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new HttpException(500, 'Không thể tạo thư mục lưu trữ');
        }
        $filename = bin2hex(random_bytes(16)) . '.' . $extension;
        if (!move_uploaded_file((string) $file['tmp_name'], $directory . '/' . $filename)) {
            throw new HttpException(500, 'Không thể lưu hình ảnh');
        }
        return $module . '/' . $filename;
    }

    public static function delete(?string $relativePath): void
    {
        if ($relativePath === null || $relativePath === '') {
            return;
        }
        $absolute = self::absolutePath($relativePath);
        if ($absolute !== null && is_file($absolute)) {
            @unlink($absolute);
        }
    }

    public static function absolutePath(string $relativePath): ?string
    {
        $relativePath = str_replace('\\', '/', $relativePath);
        if (str_contains($relativePath, '..') || !preg_match('#^[a-z0-9_-]+/[a-zA-Z0-9._-]+$#', $relativePath)) {
            return null;
        }
        $absolute = realpath(BASE_PATH . '/storage/uploads');
        if ($absolute === false) {
            return null;
        }
        $full = $absolute . '/' . $relativePath;
        $directory = realpath(dirname($full));
        if ($directory === false || $directory !== $absolute . '/' . explode('/', $relativePath)[0]) {
            return null;
        }
        return is_file($full) ? $full : null;
    }
}
