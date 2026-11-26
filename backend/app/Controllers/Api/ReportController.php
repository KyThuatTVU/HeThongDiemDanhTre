<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Services\ReportService;

final class ReportController extends Controller
{
    public function students(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'status' => 'nullable|in:active,paused,left',
            'class_id' => 'nullable|integer',
            'q' => 'nullable|string|max:100',
        ]);
        $filters = [
            'branch_id' => $branchId,
            'status' => (string) ($data['status'] ?? ''),
            'class_id' => !empty($data['class_id']) ? (int) $data['class_id'] : null,
            'q' => trim((string) ($data['q'] ?? '')),
        ];
        $rows = (new ReportService())->students($filters);
        $this->ok($rows, ['total' => count($rows)]);
    }

    public function attendance(): never
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
        $rows = (new ReportService())->attendance($filters);
        $this->ok($rows, ['total' => count($rows), 'date_from' => $filters['date_from'], 'date_to' => $filters['date_to']]);
    }

    public function attendanceSummary(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'year' => 'nullable|integer|min:2000|max:2100',
            'month' => 'nullable|integer|min:1|max:12',
            'class_id' => 'nullable|integer',
        ]);
        $year = (int) ($data['year'] ?? date('Y'));
        $month = (int) ($data['month'] ?? date('n'));
        $classId = !empty($data['class_id']) ? (int) $data['class_id'] : null;
        $rows = (new ReportService())->attendanceSummary($branchId, $year, $month, $classId);
        $this->ok($rows, ['total' => count($rows), 'year' => $year, 'month' => $month]);
    }

    public function tuition(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'year' => 'nullable|integer|min:2000|max:2100',
            'month' => 'nullable|integer|min:1|max:12',
            'status' => 'nullable|in:unpaid,partial,paid',
            'q' => 'nullable|string|max:100',
        ]);
        $filters = [
            'branch_id' => $branchId,
            'year' => (int) ($data['year'] ?? date('Y')),
            'month' => (int) ($data['month'] ?? date('n')),
            'status' => (string) ($data['status'] ?? ''),
            'q' => trim((string) ($data['q'] ?? '')),
        ];
        $rows = (new ReportService())->tuition($filters);
        $this->ok($rows, ['total' => count($rows), 'year' => $filters['year'], 'month' => $filters['month']]);
    }

    public function movements(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'year' => 'nullable|integer|min:2000|max:2100',
        ]);
        $this->ok((new ReportService())->movements($branchId, (int) ($data['year'] ?? date('Y'))));
    }
}
