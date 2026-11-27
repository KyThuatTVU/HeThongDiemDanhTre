<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Exceptions\HttpException;
use App\Services\StudentService;

final class StudentController extends Controller
{
    public function index(): never
    {
        $filters = [
            'branch_id' => $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null),
            'status' => (string) $this->request->input('status', ''),
            'class_id' => $this->request->input('class_id') !== null && $this->request->input('class_id') !== ''
                ? (int) $this->request->input('class_id')
                : null,
            'q' => trim((string) $this->request->input('q', '')),
            'include_deleted' => $this->can('students.restore')
                ? (string) $this->request->input('include_deleted', '')
                : false,
        ];
        $page = $this->page();
        $perPage = $this->perPage();
        $result = (new StudentService())->list($filters, $page, $perPage);
        $result['items'] = array_map(fn (array $student): array => $this->maskStudent($student), $result['items']);
        $this->ok($result['items'], $this->meta($result['total'], $page, $perPage));
    }

    public function search(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $keyword = trim((string) $this->request->input('q', ''));
        if (mb_strlen($keyword) < 1) {
            throw new HttpException(422, 'Vui lòng nhập từ khoá tìm kiếm');
        }
        $this->ok((new StudentService())->search($branchId, $keyword));
    }

    public function show(string $id): never
    {
        $detail = (new StudentService())->detail((int) $id);
        $detail['student'] = $this->maskStudent($detail['student']);
        $this->ok($detail);
    }

    public function parentSlip(string $id): never
    {
        if (!$this->can('students.view') && !$this->can('attendance.view')) {
            throw new HttpException(403, 'Bạn không có quyền xem phiếu thống kê học viên');
        }
        $year = (int) $this->request->input('year', (int) date('Y'));
        $month = (int) $this->request->input('month', (int) date('n'));
        if ($year < 2000 || $year > 2100 || $month < 1 || $month > 12) {
            throw new HttpException(422, 'Tháng hoặc năm không hợp lệ');
        }
        $includeTuition = $this->can('tuition.view') || $this->can('students.view');
        $this->ok((new StudentService())->parentSlip((int) $id, $year, $month, $includeTuition));
    }

    public function store(): never
    {
        $data = $this->validate($this->request->all(), [
            'student_code' => 'required|string|max:30',
            'full_name' => 'required|string|max:120',
            'dob' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'study_format' => 'nullable|string|max:100',
            'monthly_fee' => 'nullable|numeric|min:0|max:999999999999',
            'guardian_name' => 'nullable|string|max:120',
            'guardian_phone' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:255',
            'enrollment_date' => 'nullable|date',
            'status' => 'nullable|in:active,paused,left',
            'notes' => 'nullable|string|max:2000',
            'identity_code' => 'nullable|string|max:20',
            'class_id' => 'nullable|integer|exists:classes,id',
        ], [
            'student_code' => 'Mã học viên',
            'full_name' => 'Họ tên học viên',
            'monthly_fee' => 'Học phí thoả thuận',
            'identity_code' => 'Mã định danh',
            'class_id' => 'Lớp học',
        ]);
        $data['branch_id'] = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $this->created((new StudentService())->create($data, $this->userId()));
    }

    public function update(string $id): never
    {
        $data = $this->validate($this->request->all(), [
            'student_code' => 'nullable|string|max:30',
            'full_name' => 'nullable|string|max:120',
            'dob' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'study_format' => 'nullable|string|max:100',
            'monthly_fee' => 'nullable|numeric|min:0|max:999999999999',
            'guardian_name' => 'nullable|string|max:120',
            'guardian_phone' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:255',
            'enrollment_date' => 'nullable|date',
            'status' => 'nullable|in:active,paused,left',
            'left_at' => 'nullable|date',
            'notes' => 'nullable|string|max:2000',
            'identity_code' => 'nullable|string|max:20',
            'class_id' => 'nullable|integer|exists:classes,id',
        ]);
        $data = $this->nullableEmpties($data, [
            'dob', 'gender', 'study_format', 'guardian_name', 'guardian_phone',
            'address', 'notes', 'identity_code', 'class_id',
        ]);
        unset($data['branch_id']);
        $detail = (new StudentService())->update($id === '' ? 0 : (int) $id, $data, $this->userId(), $this->can('classes.assign'));
        $detail['student'] = $this->maskStudent($detail['student']);
        $this->ok($detail);
    }

    public function destroy(string $id): never
    {
        (new StudentService())->softDelete((int) $id, $this->userId());
        $this->message('Đã xoá học viên (có thể khôi phục)');
    }

    public function restore(string $id): never
    {
        $detail = (new StudentService())->restore((int) $id, $this->userId());
        $detail['student'] = $this->maskStudent($detail['student']);
        $this->ok($detail);
    }

    public function transferBranch(string $id): never
    {
        $data = $this->validate($this->request->all(), [
            'to_branch_id' => 'required|integer|exists:branches,id',
            'reason' => 'nullable|string|max:255',
        ], ['to_branch_id' => 'Cơ sở đích']);
        $detail = (new StudentService())->transferBranch(
            (int) $id,
            (int) $data['to_branch_id'],
            isset($data['reason']) ? trim((string) $data['reason']) : null,
            $this->userId()
        );
        $detail['student'] = $this->maskStudent($detail['student']);
        $this->ok($detail);
    }

    public function avatar(string $id): never
    {
        $file = $this->request->file('avatar');
        if ($file === null) {
            throw new HttpException(422, 'Vui lòng chọn ảnh học viên');
        }
        $path = (new StudentService())->updateAvatar((int) $id, $file, $this->userId());
        $this->message('Cập nhật ảnh học viên thành công', ['avatar_path' => $path]);
    }

    private function maskStudent(array $student): array
    {
        if (!$this->can('students.update') && !empty($student['identity_code'])) {
            $identity = (string) $student['identity_code'];
            $student['identity_code'] = '******' . substr($identity, -4);
        }
        return $student;
    }
}
