<?php
declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Controller;
use App\Services\TuitionService;

final class TuitionController extends Controller
{
    public function index(): never
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
        $page = $this->page();
        $perPage = $this->perPage(20);
        $result = (new TuitionService())->board($filters, $page, $perPage);
        $this->ok($result['items'], $this->meta($result['total'], $page, $perPage) + ['totals' => $result['totals']]);
    }

    public function generate(): never
    {
        $branchId = $this->resolveBranch($this->request->input('branch_id') !== null ? (int) $this->request->input('branch_id') : null);
        $data = $this->validate($this->request->all(), [
            'year' => 'nullable|integer|min:2000|max:2100',
            'month' => 'nullable|integer|min:1|max:12',
        ]);
        $result = (new TuitionService())->generate(
            $branchId,
            (int) ($data['year'] ?? date('Y')),
            (int) ($data['month'] ?? date('n')),
            $this->userId()
        );
        $this->message('Tạo bảng học phí hoàn tất', $result);
    }

    public function show(string $id): never
    {
        $this->ok((new TuitionService())->detail((int) $id));
    }

    public function adjust(string $id): never
    {
        $data = $this->validate($this->request->all(), [
            'amount' => 'required|numeric|min:1',
            'reason' => 'required|string|max:255',
        ], ['amount' => 'Số tiền giảm trừ', 'reason' => 'Lý do giảm trừ']);
        $this->ok((new TuitionService())->addAdjustment(
            (int) $id,
            (float) $data['amount'],
            trim((string) $data['reason']),
            $this->userId()
        ));
    }

    public function collect(string $id): never
    {
        $data = $this->validate($this->request->all(), [
            'amount' => 'required|numeric|min:1',
            'paid_on' => 'nullable|date',
            'method' => 'nullable|in:cash,transfer,other',
            'note' => 'nullable|string|max:255',
        ], ['amount' => 'Số tiền thu']);
        $this->ok((new TuitionService())->collect(
            (int) $id,
            (float) $data['amount'],
            (string) ($data['paid_on'] ?? today()),
            (string) ($data['method'] ?? 'cash'),
            isset($data['note']) ? trim((string) $data['note']) : null,
            $this->userId()
        ));
    }
}
