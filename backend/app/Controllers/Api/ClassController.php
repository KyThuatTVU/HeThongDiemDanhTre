<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Services\ClassService;

final class ClassController extends Controller
{
    public function index(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $includeInactive = (bool) filter_var($this->request->input('include_inactive', true), FILTER_VALIDATE_BOOLEAN);
        $this->ok((new ClassService())->list($branchId, $includeInactive));
    }

    public function show(string $id): never
    {
        $this->ok((new ClassService())->detail((int) $id));
    }

    public function store(): never
    {
        $data = $this->validate($this->request->all(), [
            'name' => 'required|string|max:120',
            'note' => 'nullable|string|max:255',
        ], ['name' => 'Tên lớp']);
        $data['branch_id'] = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $this->created((new ClassService())->create($data, $this->userId()));
    }

    public function update(string $id): never
    {
        $data = $this->validate($this->request->all(), [
            'name' => 'nullable|string|max:120',
            'note' => 'nullable|string|max:255',
            'status' => 'nullable|in:active,inactive',
        ]);
        $this->ok((new ClassService())->update((int) $id, $data, $this->userId()));
    }

    public function assign(string $id): never
    {
        $data = $this->validate($this->request->all(), [
            'student_id' => 'required|integer|exists:students,id',
            'reason' => 'nullable|string|max:255',
            'effective_date' => 'nullable|date',
        ], ['student_id' => 'Học viên']);
        $this->ok((new ClassService())->assignStudent(
            (int) $id,
            (int) $data['student_id'],
            isset($data['reason']) ? trim((string) $data['reason']) : null,
            isset($data['effective_date']) ? (string) $data['effective_date'] : null,
            $this->userId()
        ));
    }

    public function transfer(): never
    {
        $data = $this->validate($this->request->all(), [
            'student_id' => 'required|integer|exists:students,id',
            'class_id' => 'required|integer|exists:classes,id',
            'reason' => 'nullable|string|max:255',
            'effective_date' => 'nullable|date',
        ], ['student_id' => 'Học viên', 'class_id' => 'Lớp học']);
        $this->ok((new ClassService())->transferStudent(
            (int) $data['student_id'],
            (int) $data['class_id'],
            isset($data['reason']) ? trim((string) $data['reason']) : null,
            isset($data['effective_date']) ? (string) $data['effective_date'] : null,
            $this->userId()
        ));
    }
}
