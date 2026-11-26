<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Core\Response;
use App\Core\Session;
use App\Exceptions\HttpException;
use App\Services\AuthService;

final class AuthController extends Controller
{
    public function csrf(): never
    {
        Response::json(['data' => ['csrf_token' => Session::csrfToken()]]);
    }

    public function login(): never
    {
        $data = $this->validate($this->request->all(), [
            'identifier' => 'required|string|max:150',
            'password' => 'required|string|max:255',
        ], ['identifier' => 'Tài khoản', 'password' => 'Mật khẩu']);

        $payload = (new AuthService())->loginWithPassword(
            $this->request,
            (string) $data['identifier'],
            (string) $data['password']
        );
        Response::json(['message' => 'Đăng nhập thành công', 'data' => $payload]);
    }

    public function me(): never
    {
        $payload = (new AuthService())->payload($this->user());
        Response::json(['data' => $payload]);
    }

    public function logout(): never
    {
        (new AuthService())->logout();
        Response::json(['message' => 'Đăng xuất thành công']);
    }

    public function selectBranch(): never
    {
        $data = $this->validate($this->request->all(), [
            'branch_id' => 'required|integer|exists:branches,id',
        ], ['branch_id' => 'Cơ sở']);

        $result = (new AuthService())->selectBranch((int) $data['branch_id']);
        Response::json(['message' => 'Đã chọn cơ sở làm việc', 'data' => $result]);
    }

    public function googleUrl(): never
    {
        Response::json(['data' => ['url' => (new AuthService())->googleAuthUrl()]]);
    }

    public function googleRedirect(): never
    {
        Response::redirect((new AuthService())->googleAuthUrl());
    }

    public function googleCallback(): never
    {
        $frontend = rtrim((string) config('app.frontend_url'), '/') . '/pages/auth/login/';
        $code = (string) $this->request->input('code', '');
        $state = (string) $this->request->input('state', '');
        if ($code === '') {
            Response::redirect($frontend . '?oauth=error&message=' . urlencode('Thiếu mã xác thực từ Google'));
        }
        try {
            (new AuthService())->loginWithGoogle($code, $state);
            Response::redirect($frontend . '?oauth=success');
        } catch (HttpException $exception) {
            Response::redirect($frontend . '?oauth=error&message=' . urlencode($exception->getMessage()));
        }
    }
}
