<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Core\Response;
use App\Services\ActivityLogService;
use App\Services\MaintenanceService;

final class SystemController extends Controller
{
    public function health(): never
    {
        Response::json([
            'status' => 'ok',
            'app' => config('app.name'),
            'time' => now(),
        ]);
    }

    public function info(): never
    {
        Response::json([
            'app' => config('app.name'),
            'message' => 'HappyKidsCK Backend API',
            'version' => '1.0.0',
            'health' => url('/health'),
            'csrf' => url('/api/auth/csrf'),
            'login' => url('/api/auth/login'),
        ]);
    }

    public function storage(): never
    {
        $this->ok((new MaintenanceService())->storageStats());
    }

    public function cleanup(): never
    {
        $keepDaysRaw = $this->request->input('db_log_keep_days');
        $keepDays = is_numeric($keepDaysRaw) ? max(7, min(365, (int) $keepDaysRaw)) : null;
        $result = (new MaintenanceService())->cleanup($keepDays);
        (new ActivityLogService())->record('cleanup', 'system', null, null, 'Dọn rác cache/log/phiên và tối ưu dữ liệu');
        $this->ok($result, 'Đã dọn rác và tối ưu hệ thống thành công');
    }

    public function backupDownload(): never
    {
        (new ActivityLogService())->record('backup_download', 'system', null, null, 'Tải bản sao lưu CSDL (.sql)');
        (new MaintenanceService())->streamSqlBackup();
    }
}
