<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Core\Response;
use App\Exceptions\HttpException;
use App\Services\AuthService;
use App\Services\StaffService;

final class ProfileController extends Controller
{
    public function update(): never
    {
        $data = $this->validate($this->request->all(), [
            'full_name' => 'required|string|max:120',
            'phone' => 'nullable|string|max:30',
        ], ['full_name' => 'Họ và tên', 'phone' => 'Số điện thoại']);
        $data = $this->nullableEmpties($data, ['phone']);

        $payload = (new AuthService())->updateProfile(
            $this->userId(),
            trim((string) $data['full_name']),
            isset($data['phone']) ? trim((string) $data['phone']) : null
        );
        Response::json(['message' => 'Cập nhật thông tin thành công', 'data' => $payload]);
    }

    public function password(): never
    {
        $data = $this->validate($this->request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:10|max:255',
            'new_password_confirmation' => 'required|string',
        ], [
            'current_password' => 'Mật khẩu hiện tại',
            'new_password' => 'Mật khẩu mới',
            'new_password_confirmation' => 'Xác nhận mật khẩu',
        ]);
        if ((string) $data['new_password'] !== (string) $data['new_password_confirmation']) {
            throw new HttpException(422, 'Xác nhận mật khẩu không khớp');
        }
        (new AuthService())->changePassword(
            $this->userId(),
            (string) $data['current_password'],
            (string) $data['new_password']
        );
        Response::json(['message' => 'Đổi mật khẩu thành công']);
    }

    public function avatar(): never
    {
        $file = $this->request->file('avatar');
        if ($file === null) {
            throw new HttpException(422, 'Vui lòng chọn ảnh đại diện');
        }
        $path = (new StaffService())->updateAvatar($this->userId(), $file, $this->userId());
        Response::json(['message' => 'Cập nhật ảnh đại diện thành công', 'data' => ['avatar_path' => $path]]);
    }
}
