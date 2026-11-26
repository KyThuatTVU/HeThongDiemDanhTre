<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Core\Response;
use App\Exceptions\HttpException;
use App\Services\AuthorizationService;
use App\Services\BranchService;

final class BranchController extends Controller
{
    public function index(): never
    {
        $branches = (new BranchService())->list(false);
        $authz = new AuthorizationService();
        if (!$authz->isSuperAdmin()) {
            $allowed = $authz->currentUserBranchIds();
            $branches = array_values(array_filter(
                $branches,
                static fn (array $branch): bool => in_array((int) $branch['id'], $allowed, true)
            ));
        }
        $this->ok($branches);
    }

    public function store(): never
    {
        $data = $this->validate($this->request->all(), [
            'code' => 'required|string|max:20',
            'name' => 'required|string|max:120',
            'address' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'status' => 'nullable|in:active,inactive',
        ], ['code' => 'Mã cơ sở', 'name' => 'Tên cơ sở']);
        $data = $this->nullableEmpties($data, ['address', 'phone']);
        $this->created((new BranchService())->create($data, $this->userId()));
    }

    public function update(string $id): never
    {
        $data = $this->validate($this->request->all(), [
            'code' => 'nullable|string|max:20',
            'name' => 'nullable|string|max:120',
            'address' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'status' => 'nullable|in:active,inactive',
        ]);
        $data = $this->nullableEmpties($data, ['address', 'phone']);
        (new BranchService())->update((int) $id, $data, $this->userId());
        $this->message('Cập nhật cơ sở thành công');
    }

    public function logo(string $id): never
    {
        $file = $this->request->file('logo');
        if ($file === null) {
            throw new HttpException(422, 'Vui lòng chọn ảnh logo');
        }
        $path = (new BranchService())->updateLogo((int) $id, $file, $this->userId());
        Response::json(['message' => 'Cập nhật logo thành công', 'data' => ['logo_path' => $path]]);
    }
}
