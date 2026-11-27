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
            'session_date' => 'nullable|date',
            'slot_name' => 'nullable|string|max:50',
        ]);
        $classFilter = $this->parseClassFilter($this->request->input('class_id'));
        $date = (string) ($data['session_date'] ?? today());
        $slot = trim((string) ($data['slot_name'] ?? 'Chính'));
        $slot = $slot === '' ? 'Chính' : $slot;
        $this->ok((new AttendanceService())->board($branchId, $classFilter, $date, $slot));
    }

    public function save(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'session_date' => 'required|date',
            'slot_name' => 'nullable|string|max:50',
        ], [
            'session_date' => 'Ngày điểm danh',
        ]);
        $records = $this->request->input('records', []);
        $cleared = $this->request->input('cleared_student_ids', []);
        if (!is_array($records) || !is_array($cleared)) {
            throw new HttpException(422, 'Danh sách điểm danh không hợp lệ');
        }
        $classFilter = $this->parseClassFilter($this->request->input('class_id'));
        $slot = trim((string) ($data['slot_name'] ?? 'Chính'));
        $slot = $slot === '' ? 'Chính' : $slot;
        $result = (new AttendanceService())->save(
            $branchId,
            $classFilter,
            (string) $data['session_date'],
            $slot,
            $records,
            $this->userId(),
            array_map('intval', $cleared)
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

    public function lockDay(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'session_date' => 'required|date',
            'slot_name' => 'nullable|string|max:50',
        ], ['session_date' => 'Ngày điểm danh']);
        $slot = trim((string) ($data['slot_name'] ?? 'Chính'));
        $slot = $slot === '' ? 'Chính' : $slot;
        (new AttendanceService())->setDayLock($branchId, (string) $data['session_date'], $slot, true, $this->userId());
        $this->message('Đã khoá toàn bộ sổ điểm danh ngày ' . $data['session_date']);
    }

    public function unlockDay(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'session_date' => 'required|date',
            'slot_name' => 'nullable|string|max:50',
        ], ['session_date' => 'Ngày điểm danh']);
        $slot = trim((string) ($data['slot_name'] ?? 'Chính'));
        $slot = $slot === '' ? 'Chính' : $slot;
        (new AttendanceService())->setDayLock($branchId, (string) $data['session_date'], $slot, false, $this->userId());
        $this->message('Đã mở khoá toàn bộ sổ điểm danh ngày ' . $data['session_date']);
    }

    public function history(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'student_id' => 'nullable|integer',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
        ]);
        $classFilter = $this->parseClassFilter($this->request->input('class_id'));
        $filters = [
            'branch_id' => $branchId,
            'class_id' => $classFilter,
            'student_id' => !empty($data['student_id']) ? (int) $data['student_id'] : null,
            'date_from' => (string) ($data['date_from'] ?? date('Y-m-01')),
            'date_to' => (string) ($data['date_to'] ?? date('Y-m-t')),
        ];
        $page = $this->page();
        $perPage = $this->perPage(30);
        $result = (new AttendanceService())->history($filters, $page, $perPage);
        $this->ok($result['items'], $this->meta($result['total'], $page, $perPage));
    }

    public function monthlySheet(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'year' => 'nullable|integer|min:2000|max:2100',
            'month' => 'nullable|integer|min:1|max:12',
        ]);
        $year = (int) ($data['year'] ?? date('Y'));
        $month = (int) ($data['month'] ?? date('n'));
        $classFilter = $this->parseClassFilter($this->request->input('class_id'));
        $this->ok((new AttendanceService())->monthlySheet($branchId, $year, $month, $classFilter));
    }

    private function parseClassFilter(mixed $raw): int|string|null
    {
        if ($raw === null) {
            return null;
        }
        $value = trim((string) $raw);
        if ($value === '' || $value === 'all') {
            return null;
        }
        if ($value === 'unassigned' || $value === '0') {
            return 'unassigned';
        }
        if (!ctype_digit($value)) {
            throw new HttpException(422, 'Bộ lọc lớp học không hợp lệ');
        }
        return (int) $value;
    }
}
