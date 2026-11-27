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
        $error = (int) $file['error'];
        if ($error !== UPLOAD_ERR_OK) {
            $message = match ($error) {
                UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Hình ảnh vượt quá dung lượng máy chủ cho phép',
                UPLOAD_ERR_PARTIAL => 'Tệp chỉ được tải lên một phần, vui lòng thử lại',
                UPLOAD_ERR_NO_FILE => 'Vui lòng chọn tệp hình ảnh',
                default => 'Tải hình ảnh thất bại, vui lòng thử lại',
            };
            throw new HttpException(422, $message);
        }
        $temporary = (string) $file['tmp_name'];
        if ($temporary === '' || !is_uploaded_file($temporary)) {
            throw new HttpException(422, 'Tệp tải lên không hợp lệ');
        }
        $size = (int) $file['size'];
        $maxSize = max(1, (int) Config::get('upload.max_size_mb', 2)) * 1024 * 1024;
        if ($size <= 0) {
            throw new HttpException(422, 'Tệp tải lên rỗng hoặc không hợp lệ');
        }
        if ($size > $maxSize) {
            throw new HttpException(422, 'Hình ảnh vượt quá dung lượng cho phép (' . Config::get('upload.max_size_mb', 2) . 'MB)');
        }
        $allowedExt = array_values(array_filter(array_map(
            'strtolower',
            array_map('trim', (array) Config::get('upload.allowed_ext', ['jpg', 'jpeg', 'png', 'webp']))
        )));
        $extension = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
        if ($extension === '' || !in_array($extension, $allowedExt, true) || !isset(self::MIME_BY_EXT[$extension])) {
            throw new HttpException(422, 'Chỉ chấp nhận hình ảnh định dạng: ' . implode(', ', $allowedExt));
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($temporary);
        if (!in_array($mime, self::MIME_BY_EXT[$extension], true)) {
            throw new HttpException(422, 'Nội dung tệp không phải hình ảnh hợp lệ');
        }
        $imageInfo = @getimagesize($temporary);
        if ($imageInfo === false || (int) $imageInfo[0] <= 0 || (int) $imageInfo[1] <= 0) {
            throw new HttpException(422, 'Nội dung tệp không phải hình ảnh hợp lệ');
        }
        if (!preg_match('/^[a-z0-9_-]{1,32}$/', $module)) {
            throw new HttpException(500, 'Thư mục lưu trữ không hợp lệ');
        }
        $directory = self::uploadRoot() . '/' . $module;
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new HttpException(500, 'Không thể tạo thư mục lưu trữ');
        }
        $normalizedExt = $extension === 'jpeg' ? 'jpg' : $extension;
        $filename = bin2hex(random_bytes(16)) . '.' . $normalizedExt;
        $destination = $directory . '/' . $filename;

        // Nén & thu nhỏ ảnh tự động (tối đa 480x480px) để tiết kiệm ~95% dung lượng host miễn phí
        if (!self::optimizeAndSaveImage($temporary, $destination, $mime, $normalizedExt, (int) $imageInfo[0], (int) $imageInfo[1], $size)) {
            if (!move_uploaded_file($temporary, $destination)) {
                throw new HttpException(500, 'Không thể lưu hình ảnh');
            }
        }
        return $module . '/' . $filename;
    }

    private static function optimizeAndSaveImage(
        string $sourcePath,
        string $destinationPath,
        string $mime,
        string $extension,
        int $width,
        int $height,
        int $originalBytes
    ): bool {
        if (!extension_loaded('gd')) {
            return false;
        }
        $maxDim = max(120, (int) Config::get('upload.max_dimension', 480));
        $quality = max(50, min(92, (int) Config::get('upload.quality', 78)));

        // Tránh tràn RAM trên host miễn phí nếu ảnh quá lớn (VD > 20 megapixel)
        if ($width * $height > 20_000_000) {
            return false;
        }
        // Ảnh đã rất nhỏ (< 50KB và kích thước gọn) thì vẫn re-encode nhẹ nếu muốn hoặc giữ nguyên nếu nhỏ hơn 40KB
        if ($originalBytes <= 40 * 1024 && $width <= $maxDim && $height <= $maxDim) {
            return false;
        }

        $src = match ($mime) {
            'image/jpeg' => function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($sourcePath) : false,
            'image/png' => function_exists('imagecreatefrompng') ? @imagecreatefrompng($sourcePath) : false,
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($sourcePath) : false,
            default => false,
        };
        if ($src === false) {
            return false;
        }

        try {
            // Tự xoay ảnh chụp điện thoại theo EXIF (nếu PHP bật exif)
            if ($mime === 'image/jpeg' && function_exists('exif_read_data') && function_exists('imagerotate')) {
                $exif = @exif_read_data($sourcePath);
                $orientation = (int) ($exif['Orientation'] ?? 1);
                $rotated = match ($orientation) {
                    3 => @imagerotate($src, 180, 0),
                    6 => @imagerotate($src, -90, 0),
                    8 => @imagerotate($src, 90, 0),
                    default => false,
                };
                if ($rotated !== false) {
                    imagedestroy($src);
                    $src = $rotated;
                    $width = imagesx($src);
                    $height = imagesy($src);
                }
            }

            $scale = min(1.0, $maxDim / max(1, $width), $maxDim / max(1, $height));
            $targetW = max(1, (int) round($width * $scale));
            $targetH = max(1, (int) round($height * $scale));

            $dst = imagecreatetruecolor($targetW, $targetH);
            if ($dst === false) {
                return false;
            }
            try {
                if ($extension === 'png' || $extension === 'webp') {
                    imagealphablending($dst, false);
                    imagesavealpha($dst, true);
                    $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
                    imagefilledrectangle($dst, 0, 0, $targetW, $targetH, $transparent);
                } else {
                    $white = imagecolorallocate($dst, 255, 255, 255);
                    imagefilledrectangle($dst, 0, 0, $targetW, $targetH, $white);
                }

                if (!imagecopyresampled($dst, $src, 0, 0, 0, 0, $targetW, $targetH, $width, $height)) {
                    return false;
                }

                $saved = match ($extension) {
                    'jpg' => function_exists('imagejpeg') && @imagejpeg($dst, $destinationPath, $quality),
                    'png' => function_exists('imagepng') && @imagepng($dst, $destinationPath, 7),
                    'webp' => function_exists('imagewebp') && @imagewebp($dst, $destinationPath, $quality),
                    default => false,
                };
                if (!$saved || !is_file($destinationPath) || filesize($destinationPath) === 0) {
                    @unlink($destinationPath);
                    return false;
                }
                return true;
            } finally {
                imagedestroy($dst);
            }
        } finally {
            imagedestroy($src);
        }
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
        $absolute = realpath(self::uploadRoot());
        if ($absolute === false) {
            return null;
        }
        $absolute = str_replace('\\', '/', $absolute);
        $full = $absolute . '/' . $relativePath;
        $directory = realpath(dirname($full));
        if ($directory === false || str_replace('\\', '/', $directory) !== $absolute . '/' . explode('/', $relativePath)[0]) {
            return null;
        }
        return is_file($full) ? $full : null;
    }

    private static function uploadRoot(): string
    {
        $path = str_replace('\\', '/', (string) Config::get('upload.dir', 'storage/uploads'));
        if (!str_starts_with($path, '/') && !preg_match('#^[A-Za-z]:/#', $path)) {
            $path = BASE_PATH . '/' . ltrim($path, '/');
        }
        $path = rtrim($path, '/');
        if (str_contains($path, '..')) {
            throw new HttpException(500, 'Thư mục lưu trữ không hợp lệ');
        }
        return $path;
    }
}
