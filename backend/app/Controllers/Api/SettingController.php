<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Exceptions\HttpException;
use App\Services\SettingService;

final class SettingController extends Controller
{
    public function index(): never
    {
        $this->ok((new SettingService())->all());
    }

    public function save(): never
    {
        $settings = $this->request->input('settings');
        if (!is_array($settings)) {
            throw new HttpException(422, 'Dữ liệu cấu hình không hợp lệ');
        }
        $this->ok((new SettingService())->save($settings, $this->userId()));
    }
}
