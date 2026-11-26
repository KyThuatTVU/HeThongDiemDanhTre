<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Exceptions\HttpException;
use App\Services\AttendanceService;

final class AttendanceController extends Controller
{
    public function board(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'class_id' => 'required|integer|exists:classes,id',
            'session_date' => 'nullable|date',
            'slot_name' => 'nullable|string|max:50',
        ], ['class_id' => 'Lớp học']);
        $date = (string) ($data['session_date'] ?? today());
        $slot = trim((string) ($data['slot_name'] ?? 'Chính'));
        $slot = $slot === '' ? 'Chính' : $slot;
        $this->ok((new AttendanceService())->board($branchId, (int) $data['class_id'], $date, $slot));
    }

    public function save(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'class_id' => 'required|integer|exists:classes,id',
            'session_date' => 'required|date',
            'slot_name' => 'nullable|string|max:50',
            'records' => 'required',
        ], [
            'class_id' => 'Lớp học',
            'session_date' => 'Ngày điểm danh',
            'records' => 'Danh sách điểm danh',
        ]);
        if (!is_array($data['records'])) {
            throw new HttpException(422, 'Danh sách điểm danh không hợp lệ');
        }
        $slot = trim((string) ($data['slot_name'] ?? 'Chính'));
        $slot = $slot === '' ? 'Chính' : $slot;
        $result = (new AttendanceService())->save(
            $branchId,
            (int) $data['class_id'],
            (string) $data['session_date'],
            $slot,
            $data['records'],
            $this->userId()
        );
        $this->message('Lưu điểm danh thành công', $result);
    }

    public function lock(string $id): never
    {
        (new AttendanceService())->lock((int) $id, $this->userId());
        $this->message('Đã khoá sổ điểm danh');
    }

    public function unlock(string $id): never
    {
        (new AttendanceService())->unlock((int) $id, $this->userId());
        $this->message('Đã mở khoá sổ điểm danh');
    }

    public function history(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'class_id' => 'nullable|integer',
            'student_id' => 'nullable|integer',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
        ]);
        $filters = [
            'branch_id' => $branchId,
            'class_id' => !empty($data['class_id']) ? (int) $data['class_id'] : null,
            'student_id' => !empty($data['student_id']) ? (int) $data['student_id'] : null,
            'date_from' => (string) ($data['date_from'] ?? date('Y-m-01')),
            'date_to' => (string) ($data['date_to'] ?? date('Y-m-t')),
        ];
        $page = $this->page();
        $perPage = $this->perPage(30);
        $result = (new AttendanceService())->history($filters, $page, $perPage);
        $this->ok($result['items'], $this->meta($result['total'], $page, $perPage));
    }
}
