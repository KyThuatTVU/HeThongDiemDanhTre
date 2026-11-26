<?php
declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use App\Infrastructure\Storage\FileStorage;
use App\Models\Student;
use App\Repositories\AttendanceRepository;
use App\Repositories\ClassRepository;
use App\Repositories\StudentClassHistoryRepository;
use App\Repositories\StudentRepository;
use App\Repositories\TuitionRepository;

final class StudentService
{
    private StudentRepository $students;
    private ClassRepository $classes;
    private StudentClassHistoryRepository $histories;
    private AttendanceRepository $attendance;
    private TuitionRepository $tuition;
    private AuthorizationService $authz;
    private ActivityLogService $logs;

    public function __construct()
    {
        $this->students = new StudentRepository();
        $this->classes = new ClassRepository();
        $this->histories = new StudentClassHistoryRepository();
        $this->attendance = new AttendanceRepository();
        $this->tuition = new TuitionRepository();
        $this->authz = new AuthorizationService();
        $this->logs = new ActivityLogService();
    }

    public function list(array $filters, int $page, int $perPage): array
    {
        $result = $this->students->paginate($filters, $page, $perPage);
        return [
            'items' => array_map(fn (Student $student): array => $this->payload($student), $result['items']),
            'total' => $result['total'],
        ];
    }

    public function search(int $branchId, string $keyword): array
    {
        return $this->students->autocomplete($branchId, $keyword);
    }

    public function create(array $data, int $actorId): array
    {
        $code = trim((string) $data['student_code']);
        if ($this->students->findByCode($code) !== null) {
            throw new HttpException(422, 'Mã học viên đã tồn tại');
        }
        $identityCode = $this->nullableString($data['identity_code'] ?? null);
        if ($identityCode !== null && $this->students->findByIdentityCode($identityCode) !== null) {
            throw new HttpException(422, 'Mã định danh đã tồn tại trong hệ thống');
        }

        $branchId = (int) $data['branch_id'];
        $this->authz->assertBranch($branchId);
        $classId = null;
        if (!empty($data['class_id'])) {
            $classId = $this->validateClassForBranch((int) $data['class_id'], $branchId);
        }
        $status = (string) ($data['status'] ?? 'active');
        $enrollmentDate = $this->nullableString($data['enrollment_date'] ?? null);

        $id = $this->students->create([
            'branch_id' => $branchId,
            'current_class_id' => $classId,
            'student_code' => $code,
            'full_name' => trim((string) $data['full_name']),
            'dob' => $this->nullableString($data['dob'] ?? null),
            'gender' => $this->nullableString($data['gender'] ?? null),
            'study_format' => $this->nullableString($data['study_format'] ?? null),
            'monthly_fee' => (float) ($data['monthly_fee'] ?? 0),
            'guardian_name' => $this->nullableString($data['guardian_name'] ?? null),
            'guardian_phone' => $this->nullableString($data['guardian_phone'] ?? null),
            'address' => $this->nullableString($data['address'] ?? null),
            'enrollment_date' => $enrollmentDate,
            'status' => $status,
            'left_at' => $status === 'left' ? today() : null,
            'notes' => $this->nullableString($data['notes'] ?? null),
            'identity_code' => $identityCode,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        if ($classId !== null) {
            $this->histories->create($id, $classId, $enrollmentDate ?? today(), 'Gán lớp khi tạo hồ sơ', $actorId);
        }
        $this->logs->record('create', 'students', 'student', $id, 'Thêm học viên ' . $data['full_name'], null, $data);
        return $this->detail($id);
    }

    public function update(int $id, array $data, int $actorId, bool $allowClassChange): array
    {
        $student = $this->students->findDetail($id);
        if ($student === null) {
            throw new HttpException(404, 'Không tìm thấy học viên');
        }
        if ($student->deleted_at !== null) {
            throw new HttpException(422, 'Học viên đã bị xoá, vui lòng khôi phục trước khi chỉnh sửa');
        }
        $this->authz->assertBranch((int) $student->branch_id);

        $payload = [];
        foreach (['full_name', 'dob', 'gender', 'study_format', 'guardian_name', 'guardian_phone', 'address', 'enrollment_date', 'notes'] as $field) {
            if (array_key_exists($field, $data)) {
                $payload[$field] = in_array($field, ['full_name'], true)
                    ? trim((string) $data[$field])
                    : $this->nullableString($data[$field]);
            }
        }
        foreach (['monthly_fee', 'status'] as $field) {
            if (array_key_exists($field, $data)) {
                $payload[$field] = $data[$field];
            }
        }
        if (array_key_exists('student_code', $data)) {
            $code = trim((string) $data['student_code']);
            if ($this->students->findByCode($code, $id) !== null) {
                throw new HttpException(422, 'Mã học viên đã tồn tại');
            }
            $payload['student_code'] = $code;
        }
        if (array_key_exists('identity_code', $data)) {
            $identityCode = $this->nullableString($data['identity_code']);
            if ($identityCode !== null && $this->students->findByIdentityCode($identityCode, $id) !== null) {
                throw new HttpException(422, 'Mã định danh đã tồn tại trong hệ thống');
            }
            $payload['identity_code'] = $identityCode;
        }

        $newStatus = $payload['status'] ?? null;
        if ($newStatus !== null && $newStatus !== $student->status) {
            $payload['left_at'] = $newStatus === 'left' ? ($this->nullableString($data['left_at'] ?? null) ?? today()) : null;
        }

        if (array_key_exists('class_id', $data)) {
            $newClassId = $data['class_id'] !== null && $data['class_id'] !== '' ? (int) $data['class_id'] : null;
            $currentClassId = $student->current_class_id !== null ? (int) $student->current_class_id : null;
            if ($newClassId !== $currentClassId) {
                if (!$allowClassChange) {
                    throw new HttpException(403, 'Bạn không có quyền chuyển lớp cho học viên');
                }
                if ($newClassId !== null) {
                    $newClassId = $this->validateClassForBranch($newClassId, (int) $student->branch_id);
                }
                $effectiveDate = today();
                $this->histories->closeOpenForStudent($id, $effectiveDate, 'Chuyển lớp khi cập nhật hồ sơ');
                if ($newClassId !== null) {
                    $this->histories->create($id, $newClassId, $effectiveDate, 'Chuyển lớp khi cập nhật hồ sơ', $actorId);
                }
                $payload['current_class_id'] = $newClassId;
            }
        }

        if ($payload === []) {
            throw new HttpException(422, 'Không có dữ liệu cần cập nhật');
        }
        $payload['updated_by'] = $actorId;
        $old = $this->snapshot($student);
        $this->students->update($id, $payload);
        $this->logs->record('update', 'students', 'student', $id, 'Cập nhật hồ sơ học viên ' . $student->full_name, $old, $payload);
        return $this->detail($id);
    }

    public function softDelete(int $id, int $actorId): void
    {
        $student = $this->students->findDetail($id);
        if ($student === null) {
            throw new HttpException(404, 'Không tìm thấy học viên');
        }
        if ($student->deleted_at !== null) {
            throw new HttpException(422, 'Học viên đã được xoá trước đó');
        }
        $this->authz->assertBranch((int) $student->branch_id);
        $this->students->softDelete($id, $actorId);
        $this->logs->record('delete', 'students', 'student', $id, 'Xoá mềm học viên ' . $student->full_name);
    }

    public function restore(int $id, int $actorId): array
    {
        $student = $this->students->findDetail($id);
        if ($student === null) {
            throw new HttpException(404, 'Không tìm thấy học viên');
        }
        if ($student->deleted_at === null) {
            throw new HttpException(422, 'Học viên hiện không bị xoá');
        }
        $this->authz->assertBranch((int) $student->branch_id);
        $this->students->restore($id);
        $this->logs->record('restore', 'students', 'student', $id, 'Khôi phục học viên ' . $student->full_name);
        return $this->detail($id);
    }

    public function transferBranch(int $id, int $toBranchId, ?string $reason, int $actorId): array
    {
        $student = $this->students->findDetail($id);
        if ($student === null) {
            throw new HttpException(404, 'Không tìm thấy học viên');
        }
        if ($student->deleted_at !== null) {
            throw new HttpException(422, 'Học viên đã bị xoá, không thể chuyển cơ sở');
        }
        $fromBranchId = (int) $student->branch_id;
        if ($toBranchId === $fromBranchId) {
            throw new HttpException(422, 'Cơ sở đích phải khác cơ sở hiện tại');
        }
        $this->authz->assertBranch($fromBranchId);
        $this->authz->assertBranch($toBranchId);

        \App\Infrastructure\Database\Connection::transaction(function () use ($student, $id, $fromBranchId, $toBranchId, $reason, $actorId): void {
            if ($student->current_class_id !== null) {
                $this->histories->closeOpenForStudent($id, today(), $reason ?? 'Chuyển cơ sở');
            }
            $this->students->createBranchHistory([
                'student_id' => $id,
                'from_branch_id' => $fromBranchId,
                'to_branch_id' => $toBranchId,
                'moved_at' => now(),
                'reason' => $reason,
                'performed_by' => $actorId,
            ]);
            $this->students->update($id, [
                'branch_id' => $toBranchId,
                'current_class_id' => null,
                'updated_by' => $actorId,
            ]);
        });

        $this->logs->record(
            'transfer_branch',
            'students',
            'student',
            $id,
            'Chuyển cơ sở học viên ' . $student->full_name,
            ['branch_id' => $fromBranchId],
            ['branch_id' => $toBranchId, 'reason' => $reason]
        );
        return $this->detail($id);
    }

    public function updateAvatar(int $id, array $file, int $actorId): string
    {
        $student = $this->students->findDetail($id);
        if ($student === null) {
            throw new HttpException(404, 'Không tìm thấy học viên');
        }
        $this->authz->assertBranch((int) $student->branch_id);
        $path = FileStorage::storeImage($file, 'students');
        FileStorage::delete((string) $student->avatar_path);
        $this->students->update($id, ['avatar_path' => $path, 'updated_by' => $actorId]);
        $this->logs->record('update_avatar', 'students', 'student', $id, 'Cập nhật ảnh học viên');
        return $path;
    }

    public function detail(int $id): array
    {
        $student = $this->students->findDetail($id);
        if ($student === null) {
            throw new HttpException(404, 'Không tìm thấy học viên');
        }
        $this->authz->assertBranch((int) $student->branch_id);
        $branchId = (int) $student->branch_id;
        $attendance = $this->attendance->history(['branch_id' => $branchId, 'student_id' => $id], 1, 10);
        return [
            'student' => $this->payload($student),
            'class_histories' => $this->students->classHistories($id),
            'branch_histories' => $this->students->branchHistories($id),
            'recent_attendance' => $attendance['items'],
            'recent_tuition' => $this->tuition->recentByStudent($id),
        ];
    }

    public function payload(Student $student): array
    {
        return [
            'id' => (int) $student->id,
            'branch_id' => (int) $student->branch_id,
            'branch_name' => $student->branch_name,
            'current_class_id' => $student->current_class_id !== null ? (int) $student->current_class_id : null,
            'class_name' => $student->class_name,
            'student_code' => $student->student_code,
            'full_name' => $student->full_name,
            'dob' => $student->dob,
            'gender' => $student->gender,
            'study_format' => $student->study_format,
            'monthly_fee' => (float) $student->monthly_fee,
            'guardian_name' => $student->guardian_name,
            'guardian_phone' => $student->guardian_phone,
            'address' => $student->address,
            'enrollment_date' => $student->enrollment_date,
            'status' => $student->status,
            'left_at' => $student->left_at,
            'notes' => $student->notes,
            'identity_code' => $student->identity_code,
            'avatar_path' => $student->avatar_path,
            'deleted_at' => $student->deleted_at,
            'created_at' => $student->created_at,
            'updated_at' => $student->updated_at,
        ];
    }

    private function snapshot(Student $student): array
    {
        return [
            'student_code' => $student->student_code,
            'full_name' => $student->full_name,
            'dob' => $student->dob,
            'gender' => $student->gender,
            'study_format' => $student->study_format,
            'monthly_fee' => $student->monthly_fee,
            'guardian_name' => $student->guardian_name,
            'guardian_phone' => $student->guardian_phone,
            'address' => $student->address,
            'enrollment_date' => $student->enrollment_date,
            'status' => $student->status,
            'notes' => $student->notes,
            'identity_code' => $student->identity_code,
            'current_class_id' => $student->current_class_id,
        ];
    }

    private function validateClassForBranch(int $classId, int $branchId): int
    {
        $class = $this->classes->findWithBranch($classId);
        if ($class === null) {
            throw new HttpException(422, 'Lớp học không tồn tại');
        }
        if ((int) $class->branch_id !== $branchId) {
            throw new HttpException(422, 'Lớp học không thuộc cơ sở của học viên');
        }
        if ((string) $class->status !== 'active') {
            throw new HttpException(422, 'Lớp học đã ngừng hoạt động');
        }
        return $classId;
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = trim((string) $value);
        return $value === '' ? null : $value;
    }
}
