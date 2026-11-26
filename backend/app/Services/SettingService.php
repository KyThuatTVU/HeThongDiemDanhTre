<?php
declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use App\Repositories\SettingRepository;

final class SettingService
{
    private SettingRepository $settings;
    private ActivityLogService $logs;

    public function __construct()
    {
        $this->settings = new SettingRepository();
        $this->logs = new ActivityLogService();
    }

    public function all(): array
    {
        return $this->settings->all();
    }

    public function save(array $settings, int $actorId): array
    {
        if ($settings === []) {
            throw new HttpException(422, 'Không có cấu hình cần lưu');
        }
        foreach ($settings as $key => $value) {
            if (!is_string($key) || !preg_match('/^[a-z0-9_.-]{1,100}$/', $key)) {
                throw new HttpException(422, 'Tên cấu hình không hợp lệ: ' . (string) $key);
            }
            if (is_array($value) || is_object($value)) {
                $value = json_encode($value, JSON_UNESCAPED_UNICODE);
            } elseif (is_bool($value)) {
                $value = $value ? '1' : '0';
            } elseif ($value !== null) {
                $value = (string) $value;
            }
            $this->settings->upsert($key, $value, $this->groupFor($key), '', $actorId);
        }
        $this->logs->record('update', 'settings', null, null, 'Cập nhật cấu hình: ' . implode(', ', array_keys($settings)));
        return $this->all();
    }

    private function groupFor(string $key): string
    {
        if (str_starts_with($key, 'tuition')) {
            return 'tuition';
        }
        if (str_starts_with($key, 'attendance')) {
            return 'attendance';
        }
        if (str_starts_with($key, 'backup')) {
            return 'backup';
        }
        return 'general';
    }
}
