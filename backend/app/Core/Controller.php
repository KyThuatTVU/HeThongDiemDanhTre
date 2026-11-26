<?php
declare(strict_types=1);

namespace App\Core;

use App\Models\User;
use App\Services\AuthorizationService;

abstract class Controller
{
    protected AuthorizationService $authz;

    public function __construct(protected Request $request)
    {
        $this->authz = new AuthorizationService();
    }

    protected function validate(array $data, array $rules, array $labels = []): array
    {
        return Validator::validate($data, $rules, $labels);
    }

    /**
     * Validator drops null/empty nullable fields entirely; fold explicitly-sent
     * empties back as null so update endpoints can clear optional columns.
     */
    protected function nullableEmpties(array $clean, array $fields): array
    {
        $raw = $this->request->all();
        foreach ($fields as $field) {
            if (array_key_exists($field, $raw) && ($raw[$field] === null || $raw[$field] === '')) {
                $clean[$field] = null;
            }
        }
        return $clean;
    }

    protected function user(): ?User
    {
        $user = $this->request->getAttribute('user');
        return $user instanceof User ? $user : null;
    }

    protected function userId(): int
    {
        $user = $this->user();
        return $user !== null ? (int) $user->id : (int) Session::get('user_id');
    }

    protected function resolveBranch(?int $branchId): int
    {
        return $this->authz->resolveBranch($branchId ?? (int) Session::get('current_branch_id'));
    }

    protected function ensure(string $permission): void
    {
        $this->authz->ensure($permission);
    }

    protected function can(string $permission): bool
    {
        return $this->authz->can($permission);
    }

    protected function page(): int
    {
        return max(1, (int) $this->request->input('page', 1));
    }

    protected function perPage(int $default = 15): int
    {
        return min(100, max(1, (int) $this->request->input('per_page', $default)));
    }

    protected function meta(int $total, int $page, int $perPage): array
    {
        return [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ];
    }

    protected function ok(mixed $data = null, array $meta = []): never
    {
        Response::json(['data' => $data, 'meta' => $meta]);
    }

    protected function message(string $message, mixed $data = null): never
    {
        Response::json(['message' => $message, 'data' => $data]);
    }

    protected function created(mixed $data = null): never
    {
        Response::json(['message' => 'Tạo mới thành công', 'data' => $data], 201);
    }
}
