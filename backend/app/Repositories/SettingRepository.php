<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Core\Config;
use App\Infrastructure\Cache\FileCache;

final class SettingRepository extends Repository
{
    private const CACHE_KEY = 'settings.all';

    protected string $table = 'system_settings';

    public function all(): array
    {
        return FileCache::remember(
            self::CACHE_KEY,
            (int) Config::get('cache.ttl.settings', 300),
            fn (): array => $this->fetchAll('SELECT * FROM system_settings ORDER BY setting_group, setting_key')
        );
    }

    public function get(string $key, ?string $default = null): ?string
    {
        foreach ($this->all() as $row) {
            if ((string) ($row['setting_key'] ?? '') === $key) {
                return (string) ($row['setting_value'] ?? '');
            }
        }
        return $default;
    }

    public function getJson(string $key, array $default = []): array
    {
        $value = $this->get($key);
        if ($value === null || $value === '') {
            return $default;
        }
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : $default;
    }

    public function upsert(string $key, ?string $value, string $group = 'general', string $description = '', ?int $userId = null): void
    {
        $sql = 'INSERT INTO system_settings (setting_key, setting_value, setting_group, description, updated_by)
                VALUES (:key, :value, :group, :description, :user)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_group = VALUES(setting_group),
                    description = VALUES(description), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP';
        $this->execute($sql, [
            'key' => $key,
            'value' => $value,
            'group' => $group,
            'description' => $description,
            'user' => $userId,
        ]);
        FileCache::forget(self::CACHE_KEY);
    }
}
