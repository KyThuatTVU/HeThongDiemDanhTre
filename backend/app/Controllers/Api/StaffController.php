<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Exceptions\HttpException;
use App\Services\ActivityLogService;
use App\Services\AuthorizationService;
use App\Services\StaffService;

final class StaffController extends Controller
{
    public function index(): never
    {
        $branchId = $this->request->input('branch_id');
        if ($branchId !== null && $branchId !== '') {
            $authz = new AuthorizationService();
            if (!in_array((int) $branchId, $authz->currentUserBranchIds(), true)) {
                throw new HttpException(403, 'Bạn không có quyền xem nhân viên ngoài cơ sở được phân công');
            }
        }
        $filters = [
            'q' => trim((string) $this->request->input('q', '')),
            'role_key' => (string) $this->request->input('role_key', ''),
            'status' => (string) $this->request->input('status', ''),
            'branch_id' => $branchId,
        ];
        $page = $this->page();
        $perPage = $this->perPage();
        $result = (new StaffService())->list($filters, $page, $perPage);
        $this->ok($result['items'], $this->meta($result['total'], $page, $perPage));
    }

    public function show(string $id): never
    {
        $detail = (new StaffService())->detail((int) $id);
        $logins = (new ActivityLogService())->loginList(['user_id' => (int) $id], 1, 20);
        $detail['recent_logins'] = $logins['items'];
        $this->ok($detail);
    }

    public function store(): never
    {
        $data = $this->validate($this->request->all(), [
            'full_name' => 'required|string|max:120',
            'username' => 'required|string|max:50|regex:^[a-zA-Z0-9._-]{3,50}$',
            'password' => 'required|string|min:8|max:255',
            'email' => 'nullable|email|max:150',
            'phone' => 'nullable|string|max:30',
            'role_key' => 'required|in:super_admin,branch_manager,attendance_staff,profile_staff',
            'branch_ids' => 'required|array',
            'permission_keys' => 'nullable|array',
        ], [
            'full_name' => 'Họ và tên',
            'username' => 'Tên đăng nhập',
            'password' => 'Mật khẩu',
            'role_key' => 'Vai trò',
            'branch_ids' => 'Cơ sở phân công',
        ]);
        $data['branch_ids'] = array_map('intval', (array) $data['branch_ids']);
        $this->created((new StaffService())->create($data, $this->userId()));
    }

    public function update(string $id): never
    {
        $data = $this->validate($this->request->all(), [
            'full_name' => 'nullable|string|max:120',
            'email' => 'nullable|email|max:150',
            'phone' => 'nullable|string|max:30',
            'role_key' => 'nullable|in:super_admin,branch_manager,attendance_staff,profile_staff',
            'branch_ids' => 'nullable|array',
            'permission_keys' => 'nullable|array',
        ]);
        $data = $this->nullableEmpties($data, ['email', 'phone']);
        if (array_key_exists('branch_ids', $data)) {
            $data['branch_ids'] = array_map('intval', (array) $data['branch_ids']);
        }
        $this->ok((new StaffService())->update((int) $id, $data, $this->userId()));
    }

    public function lock(string $id): never
    {
        (new StaffService())->lock((int) $id, $this->userId());
        $this->message('Đã khoá tài khoản');
    }

    public function unlock(string $id): never
    {
        (new StaffService())->unlock((int) $id, $this->userId());
        $this->message('Đã mở khoá tài khoản');
    }

    public function resetPassword(string $id): never
    {
        $data = $this->validate($this->request->all(), [
            'new_password' => 'required|string|min:8|max:255',
        ], ['new_password' => 'Mật khẩu mới']);
        (new StaffService())->resetPassword((int) $id, (string) $data['new_password'], $this->userId());
        $this->message('Đặt lại mật khẩu thành công');
    }

    public function assignBranches(string $id): never
    {
        $data = $this->validate($this->request->all(), [
            'branch_ids' => 'required|array',
        ], ['branch_ids' => 'Cơ sở phân công']);
        $result = (new StaffService())->assignBranches((int) $id, array_map('intval', (array) $data['branch_ids']), $this->userId());
        $this->message('Phân công cơ sở thành công', $result);
    }

    public function permissionCatalog(): never
    {
        $this->ok((new StaffService())->permissionCatalog());
    }

    public function assignPermissions(string $id): never
    {
        $data = $this->validate($this->request->all(), [
            'permission_keys' => 'nullable|array',
        ], ['permission_keys' => 'Danh sách quyền']);
        if (!array_key_exists('permission_keys', $data)) {
            throw new HttpException(422, 'Vui lòng gửi danh sách quyền');
        }
        $detail = (new StaffService())->assignPermissions(
            (int) $id,
            array_values((array) $data['permission_keys']),
            $this->userId()
        );
        $this->message('Cập nhật quyền thành công', $detail);
    }

    public function avatar(string $id): never
    {
        $file = $this->request->file('avatar');
        if ($file === null) {
            throw new HttpException(422, 'Vui lòng chọn ảnh đại diện');
        }
        $path = (new StaffService())->updateAvatar((int) $id, $file, $this->userId());
        $this->message('Cập nhật ảnh đại diện thành công', ['avatar_path' => $path]);
    }

    public function logins(string $id): never
    {
        (new StaffService())->detail((int) $id);
        $filters = [
            'user_id' => (int) $id,
            'status' => (string) $this->request->input('status', ''),
            'date_from' => (string) $this->request->input('date_from', ''),
            'date_to' => (string) $this->request->input('date_to', ''),
        ];
        $page = $this->page();
        $perPage = $this->perPage();
        $result = (new ActivityLogService())->loginList($filters, $page, $perPage);
        $this->ok($result['items'], $this->meta($result['total'], $page, $perPage));
    }
}
