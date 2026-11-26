<?php
declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use App\Infrastructure\Database\Connection;
use App\Models\SchoolClass;
use App\Repositories\ClassRepository;
use App\Repositories\StudentClassHistoryRepository;
use App\Repositories\StudentRepository;

final class ClassService
{
    private ClassRepository $classes;
    private StudentRepository $students;
    private StudentClassHistoryRepository $histories;
    private AuthorizationService $authz;
    private ActivityLogService $logs;

    public function __construct()
    {
        $this->classes = new ClassRepository();
        $this->students = new StudentRepository();
        $this->histories = new StudentClassHistoryRepository();
        $this->authz = new AuthorizationService();
        $this->logs = new ActivityLogService();
    }

    public function list(?int $branchId, bool $includeInactive = true): array
    {
        return array_map(static fn (SchoolClass $class): array => [
            'id' => (int) $class->id,
            'branch_id' => (int) $class->branch_id,
            'branch_name' => $class->branch_name,
            'name' => $class->name,
            'note' => $class->note,
            'status' => $class->status,
            'student_count' => (int) $class->student_count,
        ], $this->classes->listByBranch($branchId, $includeInactive));
    }

    public function create(array $data, int $actorId): array
    {
        $branchId = (int) $data['branch_id'];
        $name = trim((string) $data['name']);
        if ($this->classes->nameExists($branchId, $name)) {
            throw new HttpException(422, 'Tên lớp đã tồn tại trong cơ sở');
        }
        $id = $this->classes->create([
            'branch_id' => $branchId,
            'name' => $name,
            'note' => $data['note'] ?? null,
            'status' => 'active',
            'created_by' => $actorId,
        ]);
        $this->logs->record('create', 'classes', 'class', $id, 'Thêm lớp ' . $name, null, $data);
        return $this->detail($id);
    }

    public function update(int $id, array $data, int $actorId): array
    {
        $class = $this->classes->findWithBranch($id);
        if ($class === null) {
            throw new HttpException(404, 'Không tìm thấy lớp học');
        }
        $this->authz->assertBranch((int) $class->branch_id);
        $payload = [];
        if (array_key_exists('name', $data)) {
            $name = trim((string) $data['name']);
            if ($this->classes->nameExists((int) $class->branch_id, $name, $id)) {
                throw new HttpException(422, 'Tên lớp đã tồn tại trong cơ sở');
            }
            $payload['name'] = $name;
        }
        foreach (['note', 'status'] as $field) {
            if (array_key_exists($field, $data)) {
                $payload[$field] = $data[$field];
            }
        }
        if ($payload === []) {
            throw new HttpException(422, 'Không có dữ liệu cần cập nhật');
        }
        $this->classes->update($id, $payload);
        $this->logs->record('update', 'classes', 'class', $id, 'Cập nhật lớp ' . $class->name, $class->toArray(), $payload);
        return $this->detail($id);
    }

    public function detail(int $id): array
    {
        $class = $this->classes->findWithBranch($id);
        if ($class === null) {
            throw new HttpException(404, 'Không tìm thấy lớp học');
        }
        $this->authz->assertBranch((int) $class->branch_id);
        return [
            'class' => [
                'id' => (int) $class->id,
                'branch_id' => (int) $class->branch_id,
                'branch_name' => $class->branch_name,
                'name' => $class->name,
                'note' => $class->note,
                'status' => $class->status,
                'student_count' => (int) $class->student_count,
            ],
            'students' => $this->classes->students($id),
            'class_histories' => $this->classes->historyForClass($id),
        ];
    }

    public function assignStudent(int $classId, int $studentId, ?string $reason, ?string $effectiveDate, int $actorId): array
    {
        $class = $this->classes->findWithBranch($classId);
        if ($class === null) {
            throw new HttpException(404, 'Không tìm thấy lớp học');
        }
        $this->authz->assertBranch((int) $class->branch_id);
        if ((string) $class->status !== 'active') {
            throw new HttpException(422, 'Lớp học đã ngừng hoạt động, không thể gán học viên');
        }
        $student = $this->students->findDetail($studentId);
        if ($student === null) {
            throw new HttpException(404, 'Không tìm thấy học viên');
        }
        if ($student->deleted_at !== null) {
            throw new HttpException(422, 'Học viên đã bị xoá, không thể gán lớp');
        }
        if ((int) $student->branch_id !== (int) $class->branch_id) {
            throw new HttpException(422, 'Học viên và lớp học phải thuộc cùng một cơ sở');
        }
        if ($student->current_class_id !== null && (int) $student->current_class_id === $classId) {
            throw new HttpException(422, 'Học viên đang học lớp này');
        }
        $date = $effectiveDate ?: today();

        Connection::transaction(function () use ($studentId, $classId, $student, $date, $reason, $actorId): void {
            $this->histories->closeOpenForStudent($studentId, $date, $reason ?? 'Chuyển lớp');
            $this->histories->create($studentId, $classId, $date, $reason ?? 'Gán lớp', $actorId);
            $this->students->update($studentId, [
                'current_class_id' => $classId,
                'updated_by' => $actorId,
            ]);
        });

        $this->logs->record(
            'assign_class',
            'classes',
            'class',
            $classId,
            'Gán học viên ' . $student->full_name . ' vào lớp ' . $class->name,
            ['current_class_id' => $student->current_class_id],
            ['current_class_id' => $classId, 'reason' => $reason]
        );
        return $this->detail($classId);
    }

    public function transferStudent(int $studentId, int $newClassId, ?string $reason, ?string $effectiveDate, int $actorId): array
    {
        return $this->assignStudent($newClassId, $studentId, $reason, $effectiveDate, $actorId);
    }
}
