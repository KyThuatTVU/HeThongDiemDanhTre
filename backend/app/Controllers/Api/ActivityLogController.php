<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Services\ActivityLogService;

final class ActivityLogController extends Controller
{
    public function activity(): never
    {
        $filters = [
            'user_id' => !empty($this->request->input('user_id')) ? (int) $this->request->input('user_id') : null,
            'module' => (string) $this->request->input('module', ''),
            'action' => (string) $this->request->input('action', ''),
            'date_from' => (string) $this->request->input('date_from', ''),
            'date_to' => (string) $this->request->input('date_to', ''),
        ];
        $page = $this->page();
        $perPage = $this->perPage(30);
        $result = (new ActivityLogService())->activityList($filters, $page, $perPage);
        $this->ok($result['items'], $this->meta($result['total'], $page, $perPage));
    }

    public function logins(): never
    {
        $filters = [
            'user_id' => !empty($this->request->input('user_id')) ? (int) $this->request->input('user_id') : null,
            'status' => (string) $this->request->input('status', ''),
            'date_from' => (string) $this->request->input('date_from', ''),
            'date_to' => (string) $this->request->input('date_to', ''),
        ];
        $page = $this->page();
        $perPage = $this->perPage(30);
        $result = (new ActivityLogService())->loginList($filters, $page, $perPage);
        $this->ok($result['items'], $this->meta($result['total'], $page, $perPage));
    }
}
